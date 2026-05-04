import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createWriteStream } from 'node:fs';
import PDFDocument from 'pdfkit';
import type { AgentTool } from '../types/index.js';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  );
}

async function ensureOutputDir(workspacePath: string, subdir = 'output'): Promise<string> {
  const dir = resolve(workspacePath, subdir);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function makeTextCreateTool(): AgentTool {
  return {
    name: 'text_create',
    description:
      "Create a markdown or plain-text file in the workspace's output directory. Use this for notes, reports, drafts, or any text artifact.",
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Text file creation',
      properties: {
        title: { type: 'string', description: 'Title used for the filename (slugified)' },
        content: { type: 'string', description: 'File body (markdown OK)' },
        extension: {
          type: 'string',
          description: 'File extension without the dot (default "md")',
        },
      },
      required: ['title', 'content'],
    },
    async execute(args, ctx) {
      const title = String(args.title ?? '');
      const content = String(args.content ?? '');
      const ext = String(args.extension ?? 'md').replace(/[^a-z0-9]/gi, '') || 'md';
      if (!title || !content) return { error: 'title and content are required' };
      const dir = await ensureOutputDir(ctx.workspacePath);
      const path = join(dir, `${slugify(title)}.${ext}`);
      await writeFile(path, content, 'utf8');
      return {
        success: true,
        result: `Wrote ${content.length} chars to output/${slugify(title)}.${ext}`,
      };
    },
  };
}

export function makePresentationCreateTool(): AgentTool {
  return {
    name: 'presentation_create',
    description:
      'Create a slide deck in Marp markdown format under workspace/output/. Each "---" line marks a new slide. The user can render it to HTML/PDF/PPTX with `npx @marp-team/marp-cli@latest <file>`.',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Presentation deck',
      properties: {
        title: { type: 'string', description: 'Deck title (used for the filename)' },
        slides: {
          type: 'array',
          description: 'Array of slide objects. First slide is the title slide.',
          items: {
            type: 'object',
            description: 'Slide content',
            properties: {
              heading: { type: 'string', description: 'Slide heading' },
              body: { type: 'string', description: 'Slide body (markdown bullets / text)' },
            },
            required: ['heading'],
          },
        },
        theme: {
          type: 'string',
          description: 'Marp theme: "default" | "gaia" | "uncover"',
          enum: ['default', 'gaia', 'uncover'],
        },
      },
      required: ['title', 'slides'],
    },
    async execute(args, ctx) {
      const title = String(args.title ?? '');
      const theme = String(args.theme ?? 'gaia');
      const rawSlides = Array.isArray(args.slides) ? args.slides : [];
      if (!title || rawSlides.length === 0) return { error: 'title and slides are required' };

      const slides = rawSlides
        .map((s) => {
          if (typeof s !== 'object' || s === null) return null;
          const obj = s as { heading?: unknown; body?: unknown };
          return {
            heading: typeof obj.heading === 'string' ? obj.heading : '',
            body: typeof obj.body === 'string' ? obj.body : '',
          };
        })
        .filter((s): s is { heading: string; body: string } => s !== null && Boolean(s.heading));

      if (slides.length === 0) return { error: 'no valid slides' };

      const frontmatter = [
        '---',
        'marp: true',
        `theme: ${theme}`,
        'paginate: true',
        '---',
        '',
      ].join('\n');
      const body = slides
        .map((s, i) => {
          const headingPrefix = i === 0 ? '# ' : '## ';
          const heading = `${headingPrefix}${s.heading}`;
          return s.body ? `${heading}\n\n${s.body}` : heading;
        })
        .join('\n\n---\n\n');

      const dir = await ensureOutputDir(ctx.workspacePath);
      const path = join(dir, `${slugify(title)}.md`);
      await writeFile(path, `${frontmatter}${body}\n`, 'utf8');
      return {
        success: true,
        result: `Wrote ${slides.length}-slide deck to output/${slugify(title)}.md (Marp). Render with: npx @marp-team/marp-cli@latest output/${slugify(title)}.md --pdf`,
      };
    },
  };
}

interface PdfSection {
  heading?: string;
  text: string;
}

export function makePdfCreateTool(): AgentTool {
  return {
    name: 'pdf_create',
    description:
      'Generate a PDF document from structured input (title + sections). Saved under workspace/output/. Useful for reports, summaries, briefs.',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'PDF document spec',
      properties: {
        title: { type: 'string', description: 'Document title (also used for filename)' },
        author: { type: 'string', description: 'Author name (optional)' },
        sections: {
          type: 'array',
          description: 'Document sections in order',
          items: {
            type: 'object',
            description: 'Section',
            properties: {
              heading: { type: 'string', description: 'Section heading (optional)' },
              text: { type: 'string', description: 'Section body text' },
            },
            required: ['text'],
          },
        },
      },
      required: ['title', 'sections'],
    },
    async execute(args, ctx) {
      const title = String(args.title ?? '');
      const author = typeof args.author === 'string' ? args.author : '';
      const rawSections = Array.isArray(args.sections) ? args.sections : [];
      if (!title || rawSections.length === 0) return { error: 'title and sections are required' };

      const sections = rawSections
        .map((s): PdfSection | null => {
          if (typeof s !== 'object' || s === null) return null;
          const obj = s as { heading?: unknown; text?: unknown };
          return {
            ...(typeof obj.heading === 'string' ? { heading: obj.heading } : {}),
            text: typeof obj.text === 'string' ? obj.text : '',
          };
        })
        .filter((s): s is PdfSection => s !== null && Boolean(s.text));

      if (sections.length === 0) return { error: 'no valid sections' };

      const dir = await ensureOutputDir(ctx.workspacePath);
      const path = join(dir, `${slugify(title)}.pdf`);
      await mkdir(dirname(path), { recursive: true });

      await new Promise<void>((resolveDone, rejectDone) => {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
        });
        const stream = createWriteStream(path);
        doc.pipe(stream);
        doc.fontSize(24).text(title);
        if (author) doc.fontSize(11).fillColor('#666').text(`by ${author}`).fillColor('black');
        doc.moveDown(1.5);
        for (const section of sections) {
          if (section.heading) {
            doc.fontSize(16).text(section.heading);
            doc.moveDown(0.5);
          }
          doc.fontSize(12).text(section.text, { align: 'left', lineGap: 2 });
          doc.moveDown(1);
        }
        doc.end();
        stream.on('finish', () => resolveDone());
        stream.on('error', (err) => rejectDone(err));
      });

      return {
        success: true,
        result: `Wrote PDF to output/${slugify(title)}.pdf (${sections.length} sections)`,
      };
    },
  };
}
