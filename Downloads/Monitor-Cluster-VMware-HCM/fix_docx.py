#!/usr/bin/env python3
"""Lam dep file Word xuat tu tai lieu online: khoi lenh dang code web (nen xam, vien, chu Consolas), kho A4.

Chay:  python fix_docx.py <file_vao.docx> [file_ra.docx]   (bo file_ra = ghi de file vao)
"""
import re
import sys
import zipfile

CODE_STYLE = (
    '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/>'
    '<w:link w:val="CodeChar"/><w:pPr><w:keepLines/>'
    '<w:pBdr>'
    '<w:top w:val="single" w:sz="6" w:space="6" w:color="D0D7DE"/>'
    '<w:left w:val="single" w:sz="6" w:space="6" w:color="D0D7DE"/>'
    '<w:bottom w:val="single" w:sz="6" w:space="6" w:color="D0D7DE"/>'
    '<w:right w:val="single" w:sz="6" w:space="6" w:color="D0D7DE"/>'
    '</w:pBdr>'
    '<w:shd w:val="clear" w:color="auto" w:fill="F6F8FA"/>'
    '<w:spacing w:before="160" w:after="200" w:line="276" w:lineRule="auto"/>'
    '<w:ind w:left="170" w:right="170"/></w:pPr>'
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Consolas" w:cs="Consolas"/>'
    '<w:noProof/><w:color w:val="1F2328"/><w:sz w:val="19"/></w:rPr></w:style>'
)
CODE_CHAR = (
    '<w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:link w:val="Code"/>'
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Consolas" w:cs="Consolas"/>'
    '<w:noProof/><w:color w:val="C7254E"/><w:sz w:val="19"/>'
    '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:rPr></w:style>'
)


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
    files["word/document.xml"] = d.encode("utf-8")
    with zipfile.ZipFile(out or path, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)


if __name__ == "__main__":
    fix(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print("Da ghi", sys.argv[-1])
