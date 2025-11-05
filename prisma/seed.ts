import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create test users
  const user1 = await prisma.user.upsert({
    where: { email: 'maker@example.com' },
    update: {},
    create: {
      email: 'maker@example.com',
      name: 'Test Maker',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'caster@example.com' },
    update: {},
    create: {
      email: 'caster@example.com',
      name: 'Test Caster',
    },
  });

  console.log({ user1, user2 });

  // Create test spells
  const spell1 = await prisma.spell.upsert({
    where: { key: 'image-resize' },
    update: {},
    create: {
      key: 'image-resize',
      name: 'Image Resizer',
      description: 'Resize images to any dimension with high quality',
      longDescription:
        'This spell allows you to resize images to any dimension while maintaining high quality. Perfect for batch processing, thumbnail generation, and responsive image workflows.',
      version: '1.0.0',
      priceModel: 'metered',
      priceAmountCents: 50, // $0.50
      priceCurrency: 'USD',
      executionMode: 'workflow',
      tags: ['image', 'resize', 'utility'],
      category: 'Image Processing',
      rating: 4.5,
      totalCasts: 1234,
      authorId: user1.id,
      status: 'active',
    },
  });

  const spell2 = await prisma.spell.upsert({
    where: { key: 'pdf-converter' },
    update: {},
    create: {
      key: 'pdf-converter',
      name: 'PDF Converter',
      description: 'Convert documents to PDF format',
      longDescription:
        'Convert various document formats (DOCX, XLSX, PPTX, HTML) to PDF with high fidelity. Supports batch conversion and custom page settings.',
      version: '1.0.0',
      priceModel: 'one_time',
      priceAmountCents: 299, // $2.99
      priceCurrency: 'USD',
      executionMode: 'workflow',
      tags: ['pdf', 'converter', 'document'],
      category: 'Document Processing',
      rating: 4.8,
      totalCasts: 5678,
      authorId: user1.id,
      status: 'active',
    },
  });

  const spell3 = await prisma.spell.upsert({
    where: { key: 'video-transcoder' },
    update: {},
    create: {
      key: 'video-transcoder',
      name: 'Video Transcoder',
      description: 'Convert videos to different formats and resolutions',
      longDescription:
        'Professional video transcoding with support for all major formats (MP4, WebM, MOV, AVI). Includes resolution scaling, bitrate control, and codec selection.',
      version: '1.0.0',
      priceModel: 'metered',
      priceAmountCents: 150, // $1.50
      priceCurrency: 'USD',
      executionMode: 'workflow',
      tags: ['video', 'transcode', 'media'],
      category: 'Video Processing',
      rating: 4.7,
      totalCasts: 892,
      authorId: user1.id,
      status: 'active',
    },
  });

  const spell4 = await prisma.spell.upsert({
    where: { key: 'text-summarizer' },
    update: {},
    create: {
      key: 'text-summarizer',
      name: 'AI Text Summarizer',
      description: 'Generate concise summaries of long texts',
      longDescription:
        'Using advanced AI models, this spell generates accurate and concise summaries of long documents, articles, and texts. Supports multiple languages and custom summary lengths.',
      version: '1.0.0',
      priceModel: 'metered',
      priceAmountCents: 25, // $0.25
      priceCurrency: 'USD',
      executionMode: 'workflow',
      tags: ['ai', 'text', 'nlp', 'summary'],
      category: 'AI & ML',
      rating: 4.9,
      totalCasts: 3421,
      authorId: user1.id,
      status: 'active',
    },
  });

  const spell5 = await prisma.spell.upsert({
    where: { key: 'data-validator' },
    update: {},
    create: {
      key: 'data-validator',
      name: 'Data Validator',
      description: 'Validate JSON, CSV, and XML data against schemas',
      longDescription:
        'Validate your data files against custom schemas. Supports JSON Schema, CSV headers, and XML DTD/XSD. Returns detailed validation reports.',
      version: '1.0.0',
      priceModel: 'one_time',
      priceAmountCents: 99, // $0.99
      priceCurrency: 'USD',
      executionMode: 'workflow',
      tags: ['validation', 'data', 'schema'],
      category: 'Data Processing',
      rating: 4.6,
      totalCasts: 456,
      authorId: user1.id,
      status: 'active',
    },
  });

  console.log({ spell1, spell2, spell3, spell4, spell5 });

  // Create test casts
  const cast1 = await prisma.cast.create({
    data: {
      spellId: spell1.id,
      casterId: user2.id,
      status: 'completed',
      costCents: 50,
      startedAt: new Date('2025-10-26T10:00:00Z'),
      finishedAt: new Date('2025-10-26T10:01:30Z'),
      duration: 90000,
      artifactUrl: 'https://example.com/artifacts/cast1.zip',
    },
  });

  const cast2 = await prisma.cast.create({
    data: {
      spellId: spell2.id,
      casterId: user2.id,
      status: 'completed',
      costCents: 299,
      startedAt: new Date('2025-10-26T14:30:00Z'),
      finishedAt: new Date('2025-10-26T14:32:15Z'),
      duration: 135000,
      artifactUrl: 'https://example.com/artifacts/cast2.pdf',
    },
  });

  const cast3 = await prisma.cast.create({
    data: {
      spellId: spell4.id,
      casterId: user2.id,
      status: 'running',
      costCents: 25,
      startedAt: new Date(),
    },
  });

  const cast4 = await prisma.cast.create({
    data: {
      spellId: spell3.id,
      casterId: user2.id,
      status: 'failed',
      costCents: 150,
      startedAt: new Date('2025-10-26T16:00:00Z'),
      finishedAt: new Date('2025-10-26T16:01:00Z'),
      duration: 60000,
      errorMessage: 'Invalid video format',
    },
  });

  console.log({ cast1, cast2, cast3, cast4 });

  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
