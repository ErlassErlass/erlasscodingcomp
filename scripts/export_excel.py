#!/usr/bin/env python3
"""
Excel Exporter for Erlass Competition Portal
Generates professional .xlsx workbooks with native hyperlinks and clean styles.
"""

import sys
import json
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_excel(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        payload = json.load(f)

    rows = payload.get('rows', [])
    sheet_title = payload.get('sheet_title', 'Peserta Lomba')

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title[:31] # Excel sheet title limit is 31 chars
    ws.views.sheetView[0].showGridLines = True

    headers = [
        'No',
        'Kode Registrasi',
        'Nama Peserta',
        'Jenis Kelamin',
        'Tanggal Lahir',
        'Usia',
        'Kelas',
        'No. WhatsApp',
        'Alamat Lengkap',
        'Status Siswa',
        'Status Kemitraan',
        'Kategori',
        'Cabang Kompetisi',
        'Wilayah Sekolah',
        'Nama Sekolah',
        'NPSN',
        'Biaya Pendaftaran',
        'Status Pembayaran',
        'Nama Berkas Bukti Transfer',
        'Link Bukti Pembayaran',
        'Catatan Panitia',
        'Waktu Pendaftaran'
    ]

    ws.append(headers)
    ws.freeze_panes = 'A2'

    # Styles
    header_fill = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid') # Navy
    header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

    border_thin = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    alt_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid') # Light slate
    white_fill = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')

    font_regular = Font(name='Calibri', size=11)
    font_bold = Font(name='Calibri', size=11, bold=True)
    font_link = Font(name='Calibri', size=11, color='1D4ED8', underline='single') # Blue hyperlink
    font_partner = Font(name='Calibri', size=11, color='047857', italic=True) # Emerald
    font_pending = Font(name='Calibri', size=11, color='B45309', italic=True) # Amber

    # Apply header styles
    ws.row_dimensions[1].height = 28
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = border_thin

    align_center = Alignment(horizontal='center', vertical='center')
    align_left = Alignment(horizontal='left', vertical='center')
    align_right = Alignment(horizontal='right', vertical='center')

    # Append data rows
    row_idx = 2
    for r in rows:
        row_fill = alt_fill if (row_idx % 2 == 0) else white_fill
        ws.row_dimensions[row_idx].height = 20

        # Row columns:
        # 1: No
        # 2: Kode Registrasi
        # 3: Nama Peserta
        # 4: Jenis Kelamin
        # 5: Tanggal Lahir
        # 6: Usia
        # 7: Kelas
        # 8: No. WhatsApp
        # 9: Alamat Lengkap
        # 10: Status Siswa
        # 11: Status Kemitraan
        # 12: Kategori
        # 13: Cabang Kompetisi
        # 14: Wilayah Sekolah
        # 15: Nama Sekolah
        # 16: NPSN
        # 17: Biaya Pendaftaran
        # 18: Status Pembayaran
        # 19: Nama Berkas Bukti Transfer
        # 20: Link Bukti Pembayaran
        # 21: Catatan Panitia
        # 22: Waktu Pendaftaran

        c1 = ws.cell(row=row_idx, column=1, value=r.get('no', row_idx - 1))
        c1.alignment = align_center

        c2 = ws.cell(row=row_idx, column=2, value=r.get('reg_code', ''))
        c2.font = font_bold
        c2.alignment = align_center

        c3 = ws.cell(row=row_idx, column=3, value=r.get('participant_name', ''))
        c3.alignment = align_left

        c4 = ws.cell(row=row_idx, column=4, value=r.get('gender', ''))
        c4.alignment = align_center

        c5 = ws.cell(row=row_idx, column=5, value=r.get('birth_date', ''))
        c5.alignment = align_center

        c6 = ws.cell(row=row_idx, column=6, value=r.get('age', ''))
        c6.alignment = align_center

        c7 = ws.cell(row=row_idx, column=7, value=r.get('grade', ''))
        c7.alignment = align_center

        # WhatsApp formatted as text to keep leading zero
        c8 = ws.cell(row=row_idx, column=8, value=str(r.get('phone', '')))
        c8.number_format = '@'
        c8.alignment = align_left

        c9 = ws.cell(row=row_idx, column=9, value=r.get('address', ''))
        c9.alignment = align_left

        c10 = ws.cell(row=row_idx, column=10, value=r.get('student_status', ''))
        c10.alignment = align_left

        c11 = ws.cell(row=row_idx, column=11, value=r.get('partnership_status', ''))
        c11.alignment = align_left

        c12 = ws.cell(row=row_idx, column=12, value=r.get('category', ''))
        c12.alignment = align_left

        c13 = ws.cell(row=row_idx, column=13, value=r.get('branch', ''))
        c13.alignment = align_left

        c14 = ws.cell(row=row_idx, column=14, value=r.get('region', ''))
        c14.alignment = align_left

        c15 = ws.cell(row=row_idx, column=15, value=r.get('school_name', ''))
        c15.alignment = align_left

        c16 = ws.cell(row=row_idx, column=16, value=str(r.get('npsn', '-')))
        c16.number_format = '@'
        c16.alignment = align_center

        # Payment amount as numeric currency
        amount = r.get('payment_amount', 0)
        try:
            amount_val = float(amount)
        except (ValueError, TypeError):
            amount_val = 0.0
        c17 = ws.cell(row=row_idx, column=17, value=amount_val)
        c17.number_format = '#,##0'
        c17.alignment = align_right

        status_text = str(r.get('payment_status', '')).upper()
        c18 = ws.cell(row=row_idx, column=18, value=status_text)
        c18.alignment = align_center
        if status_text == 'VERIFIED':
            c18.font = Font(name='Calibri', size=11, bold=True, color='047857')
        elif status_text == 'PENDING':
            c18.font = Font(name='Calibri', size=11, bold=True, color='B45309')
        elif status_text == 'REJECTED':
            c18.font = Font(name='Calibri', size=11, bold=True, color='B91C1C')
        else:
            c18.font = font_bold

        c19 = ws.cell(row=row_idx, column=19, value=r.get('payment_proof', '-'))
        c19.alignment = align_left

        # Payment proof link
        proof_link = str(r.get('proof_link', '-'))
        c20 = ws.cell(row=row_idx, column=20)
        if proof_link.startswith('http://') or proof_link.startswith('https://'):
            c20.value = proof_link
            c20.hyperlink = proof_link
            c20.font = font_link
            c20.alignment = align_left
        elif 'Sekolah Mitra' in proof_link:
            c20.value = proof_link
            c20.font = font_partner
            c20.alignment = align_center
        elif 'Belum Unggah' in proof_link:
            c20.value = proof_link
            c20.font = font_pending
            c20.alignment = align_center
        else:
            c20.value = proof_link
            c20.alignment = align_center

        c21 = ws.cell(row=row_idx, column=21, value=r.get('admin_notes', '-'))
        c21.alignment = align_left

        c22 = ws.cell(row=row_idx, column=22, value=r.get('created_at', ''))
        c22.alignment = align_center

        # Apply borders and backgrounds
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.border = border_thin
            cell.fill = row_fill
            if cell.font is None:
                cell.font = font_regular

        row_idx += 1

    # Auto-filter
    ws.auto_filter.ref = ws.dimensions

    # Auto-fit column widths with min and max bounds
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = cell.value
            if val is not None:
                line_len = len(str(val))
                if line_len > max_len:
                    max_len = line_len
        # Set adjusted width
        adjusted_width = max(max_len + 3, 10)
        if adjusted_width > 55:
            adjusted_width = 55
        ws.column_dimensions[col_letter].width = adjusted_width

    # Save
    wb.save(output_path)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: export_excel.py <input.json> <output.xlsx>\n")
        sys.exit(1)
    build_excel(sys.argv[1], sys.argv[2])
