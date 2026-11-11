"""Build a local assessment-report draft and preserve supporting work unchanged.

Install: python -m pip install --target .tools/report-qa -r scripts/report-requirements.txt
Private metadata: copy docs/report-metadata.example.json to .artifacts/report-metadata.json.
Only local report files are written; no video upload or LMS submission is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools' / 'report-qa'))
try:
    from reportlab.graphics.shapes import Drawing, Line, Rect, String
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
except ImportError as exc:
    raise SystemExit('Install the report dependencies using scripts/report-requirements.txt.') from exc


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inline(text: str) -> str:
    value = escape(text)
    value = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', value)
    value = re.sub(r'`([^`]+)`', r'<font name="Courier">\1</font>', value)
    value = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<link href="\2" color="#086854">\1</link>', value)
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata', type=Path, default=ROOT / '.artifacts/report-metadata.json')
    parser.add_argument('--documents-root', type=Path, default=ROOT.parent / 'Documents')
    parser.add_argument('--uiux-root', type=Path, help='Optional directory containing the team UI/UX exports/source files')
    args = parser.parse_args()
    metadata_file = args.metadata if args.metadata.exists() else ROOT / 'docs/report-metadata.example.json'
    metadata = json.loads(metadata_file.read_text(encoding='utf-8-sig'))
    # Preserve the application link in older private metadata files.
    metadata.setdefault('application_url', metadata.get('hosted_url', 'PENDING - application link from the responsible team member'))
    artifacts = ROOT / '.artifacts'
    inputs = artifacts / 'report-inputs'
    inputs.mkdir(parents=True, exist_ok=True)
    registry = []
    allowed = {'.pdf', '.png', '.jpg', '.jpeg', '.svg', '.drawio', '.fig', '.docx', '.pptx', '.zip'}
    for folder, category in [('Research-and-development', 'Research-and-development'), ('Architecture Design', 'Database-Architecture'), ('Project Guideline', 'Official-Guideline')]:
        base = args.documents_root / folder
        if base.is_dir():
            for source in sorted(base.rglob('*')):
                if source.is_file() and '.git' not in source.parts and source.suffix.lower() in allowed:
                    relative = Path('supporting-documents') / category / source.relative_to(base)
                    target = inputs / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, target)
                    registry.append({'input_path': str(target.relative_to(ROOT)).replace('\\', '/'), 'package_path': relative.as_posix(), 'original_name': source.name, 'sha256': sha(source)})
    if args.uiux_root:
        if not args.uiux_root.is_dir():
            raise SystemExit('The supplied UI/UX directory does not exist.')
        for source in sorted(args.uiux_root.rglob('*')):
            if source.is_file() and not any(part in {'.git', 'node_modules'} for part in source.parts) and source.suffix.lower() in allowed:
                relative = Path('supporting-documents/UI-UX-Design') / source.relative_to(args.uiux_root)
                target = inputs / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                registry.append({'input_path': str(target.relative_to(ROOT)).replace('\\', '/'), 'package_path': relative.as_posix(), 'original_name': source.name, 'sha256': sha(source)})

    context = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {releaseContext} from './scripts/release-context.mjs'; console.log(JSON.stringify(releaseContext()));"], cwd=ROOT, text=True))
    pending = []
    for key, label in [('leader_contact', 'leader contact details'), ('application_url', 'application link from the responsible team member'), ('video_url', 'accessible video and genuine individual explanations')]:
        if not metadata.get(key) or str(metadata[key]).upper().startswith('PENDING'):
            pending.append(label)
    if not metadata.get('team_confirmed'):
        pending.append('confirmed member names and actual coding/research/design credits')
    if not any('/UI-UX-Design/' in item['package_path'] for item in registry):
        pending.append('UI/UX source/export artifacts')
    pending.append('team review and actual LMS deadline/submission')
    values = {key: str(value) for key, value in metadata.items() if isinstance(value, (str, int))}
    values.update(context)
    values['source_url'] = 'https://github.com/NSBM-SportsHub/Development/tree/' + context['source_commit']
    values['prepared_date'] = metadata.get('prepared_date', '9 November 2026')
    values['report_status'] = 'DRAFT - required submission items remain open'
    values['pending_items'] = '; '.join(pending) + '.'
    values['team_table'] = '| Member | Available allocation / attribution |\n| --- | --- |\n' + '\n'.join('| ' + str(member['name']).replace('|', '/') + ' | ' + str(member['role']).replace('|', '/') + ' |' for member in metadata['members'])
    markdown = (ROOT / 'docs/project-report.md').read_text(encoding='utf-8')
    for key, value in values.items():
        markdown = markdown.replace('{{' + key + '}}', value)
    unresolved = set(re.findall(r'\{\{([^}]+)\}\}', markdown)) - {'architecture_diagram'}
    if unresolved:
        raise SystemExit('Unresolved report fields: ' + ', '.join(sorted(unresolved)))

    font, bold = 'Helvetica', 'Helvetica-Bold'
    font_root = Path('C:/Windows/Fonts')
    if (font_root / 'segoeui.ttf').exists() and (font_root / 'segoeuib.ttf').exists():
        font, bold = 'SportsHub', 'SportsHub-Bold'
        pdfmetrics.registerFont(TTFont(font, str(font_root / 'segoeui.ttf')))
        pdfmetrics.registerFont(TTFont(bold, str(font_root / 'segoeuib.ttf')))
        pdfmetrics.registerFontFamily(font, normal=font, bold=bold, italic=font, boldItalic=bold)
    green = colors.HexColor('#075d4c')
    body = ParagraphStyle('ReportBody', fontName=font, fontSize=10.2, leading=15.3, spaceAfter=9, textColor=colors.HexColor('#23352f'))
    heading = ParagraphStyle('ReportHeading', parent=body, fontName=bold, fontSize=16, leading=21, spaceBefore=15, spaceAfter=10, textColor=green, keepWithNext=True)
    subheading = ParagraphStyle('ReportSubheading', parent=heading, fontSize=12, leading=16, spaceBefore=11)
    title = ParagraphStyle('ReportTitle', parent=heading, fontSize=30, leading=36, spaceBefore=20, spaceAfter=15)
    caption = ParagraphStyle('ReportCaption', parent=body, fontSize=8.6, leading=12.5, textColor=colors.HexColor('#52665d'), spaceAfter=13)
    cell_style = ParagraphStyle('ReportCell', parent=body, fontSize=8.6, leading=12, spaceAfter=0)
    width = A4[0] - 84
    story = []
    figures = []

    def architecture() -> Drawing:
        drawing = Drawing(width, 82)
        box_width = (width - 34) / 3
        for number, (label, detail) in enumerate([('Browser / React', 'HTML, CSS, JavaScript'), ('PHP API', 'Session, CSRF, validation'), ('MySQL', '17 persistent tables')]):
            x = number * (box_width + 17)
            drawing.add(Rect(x, 10, box_width, 60, rx=6, fillColor=colors.HexColor('#ecf5ef'), strokeColor=green))
            drawing.add(String(x + box_width / 2, 46, label, textAnchor='middle', fontName=bold, fontSize=11, fillColor=green))
            drawing.add(String(x + box_width / 2, 28, detail, textAnchor='middle', fontName=font, fontSize=8))
            if number < 2:
                drawing.add(Line(x + box_width + 2, 40, x + box_width + 15, 40, strokeColor=green))
        return drawing

    def add_table(rows: list[list[str]]) -> None:
        count = len(rows[0])
        proportions = [0.28, 0.72] if count == 2 else [0.20, 0.35, 0.45] if count == 3 else [1 / count] * count
        cells = [[Paragraph(inline(value), cell_style) for value in row] for row in rows]
        table = Table(cells, colWidths=[width * value for value in proportions], repeatRows=1, hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e1eee6')), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd9d0')), ('INNERGRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#d9e3dc')), ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
        story.extend([table, Spacer(1, 12)])

    lines = markdown.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        index += 1
        if not line:
            continue
        if line == '<!-- pagebreak -->':
            story.append(PageBreak())
        elif line == '{{architecture_diagram}}':
            story.extend([architecture(), Spacer(1, 9)])
        elif line.startswith('|'):
            rows = []
            while True:
                row = [value.strip() for value in line.strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', value.replace(' ', '')) for value in row):
                    rows.append(row)
                if index >= len(lines) or not lines[index].strip().startswith('|'):
                    break
                line = lines[index].strip()
                index += 1
            add_table(rows)
        elif line.startswith('!['):
            match = re.fullmatch(r'!\[([^]]+)\]\((evidence|input):([^)]+)\)', line)
            if not match:
                raise SystemExit('Unrecognized report image syntax.')
            label, kind, filename = match.groups()
            if Path(filename).name != filename:
                raise SystemExit('Image filenames must not contain paths.')
            if kind == 'evidence':
                path = artifacts / filename
            else:
                original = next((item for item in registry
                                 if item['package_path'].startswith('supporting-documents/Database-Architecture/')
                                 and Path(item['original_name']).suffix.lower() in {'.png', '.jpg', '.jpeg'}), None)
                if not original:
                    raise SystemExit('Database architecture image was not found in Documents/Architecture Design.')
                path = ROOT / original['input_path']
            if not path.is_file():
                raise SystemExit('Missing report image: ' + filename)
            image = Image(str(path))
            scale = min(width / image.imageWidth, 490 / image.imageHeight, 1)
            image.drawWidth, image.drawHeight = image.imageWidth * scale, image.imageHeight * scale
            image.hAlign = 'CENTER'
            figures.append({'file': filename, 'caption': label, 'sha256': sha(path)})
            story.append(KeepTogether([Spacer(1, 7), image, Spacer(1, 6), Paragraph(inline('Figure ' + str(len(figures)) + '. ' + label), caption)]))
        elif line.startswith('### '):
            story.append(Paragraph(inline(line[4:]), subheading))
        elif line.startswith('## '):
            story.append(Paragraph(inline(line[3:]), heading))
        elif line.startswith('# '):
            story.append(Paragraph(inline(line[2:]), title))
        elif line.startswith('- '):
            story.append(Paragraph(inline(line[2:]), ParagraphStyle('Bullet', parent=body, leftIndent=12, firstLineIndent=-9), bulletText='-'))
        else:
            paragraph = [line]
            while index < len(lines) and lines[index].strip() and not lines[index].lstrip().startswith(('#', '|', '- ', '![', '<!--', '{{architecture_diagram')):
                paragraph.append(lines[index].strip())
                index += 1
            story.append(Paragraph(inline(' '.join(paragraph)), body))

    output = artifacts / 'NSBM-SportsHub-Project-Report-DRAFT.pdf'
    document = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=42, leftMargin=42, topMargin=43, bottomMargin=43, title='NSBM SportsHub - Project Report (Draft)', author=metadata['leader_name'], pageCompression=1)

    def footer(canvas, doc) -> None:
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#d2dfd6'))
        canvas.line(42, 31, A4[0] - 42, 31)
        canvas.setFont(font, 8)
        canvas.setFillColor(colors.HexColor('#52665d'))
        canvas.drawString(42, 19, 'DRAFT | NSBM SportsHub | Team review and required links pending')
        canvas.drawRightString(A4[0] - 42, 19, str(doc.page))
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    (artifacts / 'project-report-filled.md').write_text(markdown.replace('{{architecture_diagram}}', '[Browser/React -> PHP API -> MySQL architecture diagram rendered in PDF]'), encoding='utf-8')
    (artifacts / 'report-supporting-files.json').write_text(json.dumps(registry, indent=2) + '\n', encoding='utf-8')
    report = {**context, 'status': 'draft', 'leader_name': metadata['leader_name'], 'report_file': output.name, 'sha256': sha(output), 'template_sha256': sha(ROOT / 'docs/project-report.md'), 'pending_items': pending, 'figures': figures, 'supporting_documents': [{key: value for key, value in item.items() if key != 'input_path'} for item in registry], 'guideline_review': 'docs/guideline-review.md', 'submission': 'not submitted'}
    (artifacts / 'project-report-evidence.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('Created report draft:', output)
    print('Figures:', len(figures), '| Preserved supporting artifacts:', len(registry))
    print('Open items:', '; '.join(pending))


if __name__ == '__main__':
    main()
