/**
 * Script para gerar o template padrão NDD-padrao.xlsx
 * 
 * Uso: node scripts/gerar-template-padrao.js
 * 
 * Este script cria o arquivo public/templates/NDD-padrao.xlsx
 * com o layout completo do NDD (cabeçalho, tabela de equipamentos, formatação).
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function gerarTemplatePadrao() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NDD Forge';
  wb.created = new Date();
  
  const aba = wb.addWorksheet('NDD', { views: [{ showGridLines: false }] });

  // Larguras das colunas
  const larguras = {
    A: 11, B: 11, C: 16, D: 15, E: 20, F: 9, G: 7, H: 10, I: 11, J: 11,
    K: 10, L: 11, M: 10, N: 10, O: 12, P: 7, Q: 12, R: 5, S: 6,
  };
  Object.entries(larguras).forEach(([col, w]) => {
    aba.getColumn(col).width = w;
  });

  // Título principal
  const titulo = aba.getCell('A1');
  aba.mergeCells('A1:S1');
  titulo.value = 'NDD — NOVA DEMANDA DE DISPONIBILIDADE';
  titulo.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titulo.fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF10233B' } };
  titulo.alignment = { horizontal: 'left', vertical: 'middle' };
  aba.getRow(1).height = 28;

  // Subtítulo
  aba.mergeCells('A2:S2');
  const sub = aba.getCell('A2');
  sub.value = 'Template padrão do NDD Forge — edite este arquivo conforme necessário';
  sub.font = { size: 9, italic: true, color: { argb: 'FF5F7896' } };

  // Função auxiliar para criar rótulos
  const rotulo = (cel, texto) => {
    const c = aba.getCell(cel);
    c.value = texto;
    c.font = { size: 9, bold: true, color: { argb: 'FF44546A' } };
  };

  // Seção 1: Identificação do Site
  const secao1 = aba.getCell('B4');
  secao1.value = '1. IDENTIFICAÇÃO DO SITE';
  secao1.font = { size: 10, bold: true, color: { argb: 'FFB45F06' } };

  rotulo('B7', 'DATA RFI:');
  rotulo('C8', 'SITE ID CLIENTE');
  rotulo('P8', 'SITE ID DETENTOR');
  rotulo('C10', 'LATITUDE');
  rotulo('J10', 'LONGITUDE');
  rotulo('B12', 'ENDEREÇO:');
  rotulo('A13', 'BAIRRO:');
  rotulo('H13', 'CIDADE:');
  rotulo('N13', 'CEP:');
  rotulo('R13', 'UF:');
  rotulo('B14', 'ALTURA EV (m):');
  rotulo('B15', 'SOLICITAÇÃO:');
  aba.getCell('C15').value = 'NOVA DISPONIBILIDADE';
  aba.getCell('C15').font = { size: 10, bold: true };

  // Seção 2: Equipamentos
  const secao2 = aba.getCell('B17');
  secao2.value = '2. EQUIPAMENTOS INSTALADOS NA EV';
  secao2.font = { size: 10, bold: true, color: { argb: 'FFB45F06' } };

  // Cabeçalho da tabela de equipamentos (linha 22)
  const bordaFin = {
    top: { style: 'thin', color: { argb: 'FF9DB2C9' } },
    left: { style: 'thin', color: { argb: 'FF9DB2C9' } },
    bottom: { style: 'thin', color: { argb: 'FF9DB2C9' } },
    right: { style: 'thin', color: { argb: 'FF9DB2C9' } },
  };

  const headers = [
    'OPERADORA', 'SITUAÇÃO', 'TIPO', 'FABRICANTE', 'MODELO', 'BANDA', 'QTDE',
    'AZIMUTE (°)', 'ALTURA (m)', 'LARGURA (m)', 'PROF. (m)', 'RAD CENTER',
    'TILT MEC.', 'TILT ELET.', 'AEV S/ CA (m²)', 'CA', 'AEV C/ CA (m²)',
  ];

  headers.forEach((h, i) => {
    const c = aba.getCell(22, i + 1);
    c.value = h;
    c.font = { size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF2C4F7C' } };
    c.border = bordaFin;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  aba.getRow(22).height = 26;

  // Linhas em branco da tabela com bordas (23 a 32)
  for (let r = 23; r <= 32; r++) {
    for (let col = 1; col <= 17; col++) {
      const c = aba.getCell(r, col);
      c.border = bordaFin;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      if (r % 2 === 0) {
        c.fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF3F7FB' } };
      }
    }
  }

  // Nota de rodapé
  aba.getCell('A34').value = 'Resumo de Equipamentos na EV: mantido pelas fórmulas do template original.';
  aba.getCell('A34').font = { size: 9, italic: true, color: { argb: 'FF808080' } };

  // Salvar o arquivo
  const outputDir = path.join(__dirname, '..', 'public', 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'NDD-padrao.xlsx');
  await wb.xlsx.writeFile(outputPath);
  console.log(`✅ Template gerado com sucesso: ${outputPath}`);
  console.log(`   Tamanho: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

gerarTemplatePadrao().catch(err => {
  console.error('❌ Erro ao gerar template:', err);
  process.exit(1);
});
