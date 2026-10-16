#!/usr/bin/env python3
"""Lam dep file Word xuat tu tai lieu online: khoi lenh nen den to mau cu phap (giong code tren web), kho A4.

Chay:  python fix_docx.py <file_vao.docx> [file_ra.docx]   (bo file_ra = ghi de file vao)
"""
import re
import sys
import zipfile

CODE_STYLE = (
    '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/>'
    '<w:link w:val="CodeChar"/><w:pPr><w:keepLines/>'
    '<w:pBdr>'
    '<w:top w:val="single" w:sz="48" w:space="4" w:color="282C34"/>'
    '<w:left w:val="single" w:sz="48" w:space="8" w:color="282C34"/>'
    '<w:bottom w:val="single" w:sz="48" w:space="4" w:color="282C34"/>'
    '<w:right w:val="single" w:sz="48" w:space="8" w:color="282C34"/>'
    '</w:pBdr>'
    '<w:shd w:val="clear" w:color="auto" w:fill="282C34"/>'
    '<w:spacing w:before="240" w:after="240" w:line="288" w:lineRule="auto"/>'
    '<w:ind w:left="284" w:right="284"/></w:pPr>'
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Consolas" w:cs="Consolas"/>'
    '<w:noProof/><w:color w:val="ABB2BF"/><w:sz w:val="19"/></w:rPr></w:style>'
)
CODE_CHAR = (
    '<w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:link w:val="Code"/>'
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Consolas" w:cs="Consolas"/>'
    '<w:noProof/><w:color w:val="C7254E"/><w:sz w:val="19"/>'
    '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:rPr></w:style>'
)

# Mau cu phap kieu One Dark (nen 282C34)
COLORS = {"comment": "7F848E", "string": "98C379", "cmd": "E5C07B", "flag": "56B6C2", "key": "E06C75", "text": "ABB2BF"}
CMDS = {"sudo", "cd", "cp", "rm", "mkdir", "for", "do", "done", "echo", "curl", "grep", "systemctl", "install", "unzip",
        "scp", "promtool", "journalctl", "python", "python3", "nano", "bash", "sha256sum", "cat", "chmod", "chown", "ls"}
TOKEN = re.compile(r"(?P<string>'[^']*'|\"[^\"]*\")|(?P<comment>(?:^|(?<=\s))#.*$)|(?P<key>^\s*-?\s*[A-Za-z_][\w\[\]']*(?=:\s|:$))"
                   r"|(?P<flag>(?<=\s)--?[A-Za-z][\w-]*)|(?P<word>[A-Za-z_][\w.\-]*)|(?P<other>.)")


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def run(text, kind):
    if not text:
        return ""
    italic = "<w:i/>" if kind == "comment" else ""
    return ('<w:r><w:rPr>%s<w:color w:val="%s"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r>'
            % (italic, COLORS[kind], esc(text)))


def highlight(line):
    out, buf, first = [], "", True
    for m in TOKEN.finditer(line):
        kind, tok = m.lastgroup, m.group(0)
        if kind == "word":
            kind = "cmd" if (first and tok in CMDS) or tok in ("sudo", "do", "done") else "text"
            first = False if tok not in ("sudo", "do") else first
        elif kind == "other":
            if tok in ";|&":
                first = True
            elif not tok.isspace():
                first = False
            kind = "text"
        if kind == "text":
            buf += tok
            continue
        out.append(run(buf, "text"))
        buf = ""
        out.append(run(tok, kind))
    out.append(run(buf, "text"))
    return "".join(out)


def unesc(t):
    return t.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")


def code_para(m):
    p = m.group(0)
    head = re.match(r'<w:p>(<w:pPr>.*?</w:pPr>)', p, re.S).group(1)
    marks = "".join(re.findall(r'<w:bookmark(?:Start|End)[^>]*/>', p))
    text = "".join("\n" if t.group(0) == "<w:br/>" else t.group(1)
                   for t in re.finditer(r'<w:t[^>]*>(.*?)</w:t>|<w:br/>', p, re.S))
    runs = '<w:r><w:br/></w:r>'.join(highlight(line) for line in unesc(text).split("\n"))
    return "<w:p>" + head + marks + runs + "</w:p>"


def fix(path, out=None):
    with zipfile.ZipFile(path) as z:
        files = {n: z.read(n) for n in z.namelist()}
    s = files["word/styles.xml"].decode("utf-8")
    s = re.sub(r'<w:style w:type="paragraph" w:styleId="Code">.*?</w:style>', lambda m: CODE_STYLE, s, flags=re.S)
    s = re.sub(r'<w:style w:type="character" w:styleId="CodeChar">.*?</w:style>', lambda m: CODE_CHAR, s, flags=re.S)
    files["word/styles.xml"] = s.encode("utf-8")
    d = files["word/document.xml"].decode("utf-8")
    d = re.sub(r'<w:pgSz [^>]*/>', '<w:pgSz w:w="11906" w:h="16838"/>', d)  # A4
    d = re.sub(r'<w:pgMar [^>]*/>', '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" '
                                     'w:header="567" w:footer="567" w:gutter="0"/>', d)
    d = re.sub(r'<w:p><w:pPr><w:pStyle w:val="Code"/>.*?</w:p>', code_para, d, flags=re.S)
    files["word/document.xml"] = d.encode("utf-8")
    with zipfile.ZipFile(out or path, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)


if __name__ == "__main__":
    fix(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print("Da ghi", sys.argv[-1])
