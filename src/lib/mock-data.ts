import { Spell } from '@/types/spell'
import { Cast, Budget } from '@/types/cast'

export const mockSpells: Spell[] = [
  {
    id: 'com.acme.resize',
    key: 'com.acme.resize',
    name: 'Image Resizer Pro',
    description: 'Fast image resizing with WebP, JPEG, PNG support. Optimized for web.',
    longDescription:
      'Resize images efficiently with support for multiple formats including WebP, JPEG, and PNG. Optimized for web delivery with automatic format detection and quality optimization.',
    author: { id: 'acme', name: 'Acme Corp', avatar: '🏢' },
    price: { model: 'flat', amount: 5, currency: 'USD' },
    tags: ['image', 'media', 'webp'],
    executionMode: 'service',
    rating: 4.8,
    totalCasts: 12543,
    reviews: [
      { user: 'alice', rating: 5, comment: 'Super fast and reliable!' },
      { user: 'bob', rating: 4, comment: 'Works great for our use case' },
    ],
  },
  {
    id: 'com.openai.summarize',
    key: 'com.openai.summarize',
    name: 'Text Summarizer AI',
    description: 'Summarize long-form text using GPT-4. Perfect for content digests.',
    longDescription:
      'AI-powered text summarization using GPT-4. Handles documents up to 10,000 words and provides concise, accurate summaries with configurable length.',
    author: { id: 'openai', name: 'OpenAI', avatar: '🤖' },
    price: { model: 'metered', amount: 12, currency: 'USD' },
    tags: ['text', 'ai', 'nlp'],
    executionMode: 'workflow',
    rating: 4.9,
    totalCasts: 8432,
    reviews: [
      { user: 'charlie', rating: 5, comment: 'Incredibly accurate summaries' },
      { user: 'diana', rating: 5, comment: 'Saves us hours of work' },
    ],
  },
  {
    id: 'com.stripe.invoice',
    key: 'com.stripe.invoice',
    name: 'Invoice Generator',
    description: 'Generate professional PDF invoices with Stripe integration.',
    longDescription:
      'Create beautiful, professional invoices with automatic Stripe payment integration. Supports multiple currencies, custom branding, and tax calculations.',
    author: { id: 'stripe', name: 'Stripe Inc', avatar: '💳' },
    price: { model: 'flat', amount: 3, currency: 'USD' },
    tags: ['billing', 'pdf', 'automation'],
    executionMode: 'service',
    rating: 4.7,
    totalCasts: 15234,
    reviews: [
      { user: 'eve', rating: 5, comment: 'Perfect for our invoicing needs' },
      { user: 'frank', rating: 4, comment: 'Clean and professional output' },
    ],
  },
  {
    id: 'com.github.backup',
    key: 'com.github.backup',
    name: 'GitHub Repo Backup',
    description: 'Automated GitHub repository backups to S3 with versioning.',
    longDescription:
      'Automatically backup your GitHub repositories to S3 with full versioning support. Includes code, issues, PRs, and wiki. Scheduled or on-demand execution.',
    author: { id: 'github', name: 'GitHub', avatar: '🐙' },
    price: { model: 'flat', amount: 10, currency: 'USD' },
    tags: ['backup', 'data', 'automation'],
    executionMode: 'workflow',
    rating: 4.6,
    totalCasts: 5621,
    reviews: [
      { user: 'grace', rating: 5, comment: 'Peace of mind for our repos' },
      { user: 'henry', rating: 4, comment: 'Reliable and thorough' },
    ],
  },
  {
    id: 'com.video.transcode',
    key: 'com.video.transcode',
    name: 'Video Transcoder',
    description: 'Convert videos to web-optimized formats (MP4, WebM, HLS).',
    longDescription:
      'Professional video transcoding service supporting MP4, WebM, and HLS output. Includes adaptive bitrate streaming, subtitle support, and thumbnail generation.',
    author: { id: 'video', name: 'VideoTech', avatar: '🎬' },
    price: { model: 'metered', amount: 25, currency: 'USD' },
    tags: ['video', 'media', 'streaming'],
    executionMode: 'service',
    rating: 4.5,
    totalCasts: 3421,
    reviews: [
      { user: 'iris', rating: 5, comment: 'High quality output' },
      { user: 'jack', rating: 4, comment: 'Good performance for the price' },
    ],
  },
  {
    id: 'com.data.etl',
    key: 'com.data.etl',
    name: 'ETL Pipeline Template',
    description: 'Clone and customize this production-ready ETL workflow.',
    longDescription:
      'Complete ETL pipeline template built with dbt and Airflow. Extract data from multiple sources, transform using SQL, and load to your data warehouse. Buy once, own forever.',
    author: { id: 'data', name: 'DataFlow', avatar: '📊' },
    price: { model: 'one_time', amount: 9900, currency: 'USD' },
    tags: ['data', 'etl', 'template'],
    executionMode: 'clone',
    rating: 4.9,
    totalCasts: 234,
    reviews: [
      { user: 'kate', rating: 5, comment: 'Saved months of development time' },
      { user: 'liam', rating: 5, comment: 'Well documented and extensible' },
    ],
  },
  {
    id: 'com.email.validator',
    key: 'com.email.validator',
    name: 'Email Validator',
    description: 'Validate email addresses with DNS, SMTP, and syntax checks.',
    longDescription:
      'Comprehensive email validation service with DNS MX record verification, SMTP checks, disposable email detection, and syntax validation.',
    author: { id: 'validator', name: 'ValidatorPro', avatar: '✉️' },
    price: { model: 'flat', amount: 1, currency: 'USD' },
    tags: ['validation', 'email', 'data'],
    executionMode: 'service',
    rating: 4.7,
    totalCasts: 18765,
    reviews: [
      { user: 'maya', rating: 5, comment: 'Catches bad emails reliably' },
      { user: 'noah', rating: 4, comment: 'Fast and accurate' },
    ],
  },
  {
    id: 'com.pdf.merge',
    key: 'com.pdf.merge',
    name: 'PDF Merger',
    description: 'Merge multiple PDFs into a single document with bookmarks.',
    longDescription:
      'Merge multiple PDF files into a single document with automatic bookmark generation, page numbering, and table of contents creation.',
    author: { id: 'pdf', name: 'PDFTools', avatar: '📄' },
    price: { model: 'flat', amount: 2, currency: 'USD' },
    tags: ['pdf', 'document', 'automation'],
    executionMode: 'service',
    rating: 4.6,
    totalCasts: 9876,
    reviews: [
      { user: 'olivia', rating: 5, comment: 'Simple and effective' },
      { user: 'peter', rating: 4, comment: 'Does exactly what we need' },
    ],
  },
]

// Generate mock casts for the last 7 days
const now = new Date()
export const mockCasts: Cast[] = [
  {
    castId: 'cast_001',
    spellId: 'com.acme.resize',
    spellName: 'Image Resizer Pro',
    status: 'succeeded',
    timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    cost: 5,
    duration: 1250,
  },
  {
    castId: 'cast_002',
    spellId: 'com.email.validator',
    spellName: 'Email Validator',
    status: 'succeeded',
    timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    cost: 1,
    duration: 320,
  },
  {
    castId: 'cast_003',
    spellId: 'com.stripe.invoice',
    spellName: 'Invoice Generator',
    status: 'succeeded',
    timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    cost: 3,
    duration: 890,
  },
  {
    castId: 'cast_004',
    spellId: 'com.openai.summarize',
    spellName: 'Text Summarizer AI',
    status: 'running',
    timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    cost: 12,
  },
  {
    castId: 'cast_005',
    spellId: 'com.acme.resize',
    spellName: 'Image Resizer Pro',
    status: 'succeeded',
    timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    cost: 5,
    duration: 1180,
  },
  {
    castId: 'cast_006',
    spellId: 'com.pdf.merge',
    spellName: 'PDF Merger',
    status: 'failed',
    timestamp: new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString(), // 1.5 days ago
    cost: 2,
    duration: 450,
  },
  {
    castId: 'cast_007',
    spellId: 'com.email.validator',
    spellName: 'Email Validator',
    status: 'succeeded',
    timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
    cost: 1,
    duration: 280,
  },
  {
    castId: 'cast_008',
    spellId: 'com.github.backup',
    spellName: 'GitHub Repo Backup',
    status: 'succeeded',
    timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(), // 3 days ago
    cost: 10,
    duration: 45000,
  },
  {
    castId: 'cast_009',
    spellId: 'com.acme.resize',
    spellName: 'Image Resizer Pro',
    status: 'succeeded',
    timestamp: new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString(), // 4 days ago
    cost: 5,
    duration: 1340,
  },
  {
    castId: 'cast_010',
    spellId: 'com.stripe.invoice',
    spellName: 'Invoice Generator',
    status: 'succeeded',
    timestamp: new Date(now.getTime() - 120 * 60 * 60 * 1000).toISOString(), // 5 days ago
    cost: 3,
    duration: 920,
  },
]

export const mockBudget: Budget = {
  cap: 100, // $100/month
  used: 23.45, // $23.45 used
}

// Usage data for the last 7 days
export const mockUsageData = [
  { day: 'Mon', casts: 12, cost: 3.2 },
  { day: 'Tue', casts: 8, cost: 2.1 },
  { day: 'Wed', casts: 15, cost: 4.8 },
  { day: 'Thu', casts: 10, cost: 2.9 },
  { day: 'Fri', casts: 18, cost: 5.6 },
  { day: 'Sat', casts: 6, cost: 1.8 },
  { day: 'Sun', casts: 14, cost: 3.05 },
]
