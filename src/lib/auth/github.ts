// GitHub OAuth Integration - TKT-003
// SPEC Reference: Section 14 (Authentication)

import { prisma } from '@/lib/prisma';

export interface GitHubUser {
  id: number;
  login: string;
  email: string;
  name?: string;
  avatar_url: string;
}

/**
 * Exchanges GitHub OAuth code for access token.
 */
export async function exchangeCodeForToken(
  code: string
): Promise<string | null> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth not configured');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const data = await response.json();

  if (data.error || !data.access_token) {
    console.error('GitHub OAuth error:', data);
    return null;
  }

  return data.access_token;
}

/**
 * Fetches GitHub user info using access token.
 */
export async function getGitHubUser(
  accessToken: string
): Promise<GitHubUser | null> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch GitHub user:', response.statusText);
    return null;
  }

  const user = await response.json();

  // Fetch primary email if not public
  let email = user.email;
  if (!email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (emailResponse.ok) {
      const emails = await emailResponse.json();
      const primaryEmail = emails.find((e: any) => e.primary);
      email = primaryEmail?.email || emails[0]?.email;
    }
  }

  return {
    id: user.id,
    login: user.login,
    email,
    name: user.name,
    avatar_url: user.avatar_url,
  };
}

/**
 * Creates or updates user from GitHub OAuth.
 * Returns user ID.
 */
export async function upsertUserFromGitHub(
  githubUser: GitHubUser
): Promise<string> {
  const existingUser = await prisma.user.findUnique({
    where: { githubId: githubUser.id.toString() },
  });

  if (existingUser) {
    // Update existing user
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        githubUsername: githubUser.login,
        name: githubUser.name || existingUser.name,
        avatarUrl: githubUser.avatar_url,
        lastLoginAt: new Date(),
      },
    });
    return updated.id;
  }

  // Create new user
  const newUser = await prisma.user.create({
    data: {
      email: githubUser.email,
      name: githubUser.name || githubUser.login,
      githubId: githubUser.id.toString(),
      githubUsername: githubUser.login,
      avatarUrl: githubUser.avatar_url,
      role: 'consumer', // Default role
      ccpaDoNotSell: false,
      lastLoginAt: new Date(),
    },
  });

  return newUser.id;
}

/**
 * Complete OAuth flow: code → token → user → DB upsert
 */
export async function handleGitHubCallback(
  code: string
): Promise<{ userId: string; isNewUser: boolean } | null> {
  const accessToken = await exchangeCodeForToken(code);
  if (!accessToken) {
    return null;
  }

  const githubUser = await getGitHubUser(accessToken);
  if (!githubUser) {
    return null;
  }

  const existingUser = await prisma.user.findUnique({
    where: { githubId: githubUser.id.toString() },
  });

  const userId = await upsertUserFromGitHub(githubUser);

  return {
    userId,
    isNewUser: !existingUser,
  };
}
