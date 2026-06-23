import { readFileSync, writeFileSync } from 'fs'
import { marked } from 'marked'

async function main() {
  console.log('📖 Lendo documentacao_sistema_ru.md...')
  const markdown = readFileSync('./documentacao_sistema_ru.md', 'utf-8')
  
  console.log('🔄 Convertendo markdown para HTML...')
  const bodyContent = await marked(markdown)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentação de Arquitetura e SSI — Sistema RU UNIFESP</title>
  <style>
    :root {
      --primary-color: #003580;
      --text-color: #2c3e50;
      --bg-color: #ffffff;
      --card-bg: #f8fafc;
      --border-color: #e2e8f0;
      --code-bg: #1e293b;
      --code-text: #f8fafc;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    h1, h2, h3, h4 {
      color: var(--primary-color);
      font-weight: 700;
      margin-top: 1.8em;
      margin-bottom: 0.5em;
    }

    h1 {
      font-size: 2.2rem;
      border-bottom: 3px solid var(--primary-color);
      padding-bottom: 12px;
      margin-top: 0;
    }

    h2 {
      font-size: 1.6rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
    }

    h3 {
      font-size: 1.25rem;
    }

    p, li {
      font-size: 1.05rem;
      margin-bottom: 1rem;
    }

    a {
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 600;
    }

    a:hover {
      text-decoration: underline;
    }

    hr {
      border: 0;
      height: 1px;
      background: var(--border-color);
      margin: 2.5rem 0;
    }

    /* Estilo para Tabelas */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.95rem;
    }

    th, td {
      border: 1px solid var(--border-color);
      padding: 12px 16px;
      text-align: left;
    }

    th {
      background-color: #f1f5f9;
      color: var(--primary-color);
      font-weight: 700;
    }

    tr:nth-child(even) {
      background-color: var(--card-bg);
    }

    /* Estilo para Blocos de Código e inline code */
    code {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace;
      font-size: 0.9rem;
      background-color: #f1f5f9;
      color: #b91c1c;
      padding: 2px 6px;
      border-radius: 4px;
    }

    pre {
      background-color: var(--code-bg);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
    }

    pre code {
      background-color: transparent;
      color: var(--code-text);
      padding: 0;
      font-size: 0.9rem;
      display: block;
    }

    /* Blockquotes e Dicas */
    blockquote {
      border-left: 4px solid var(--primary-color);
      background-color: var(--card-bg);
      margin: 1.5rem 0;
      padding: 12px 24px;
      font-style: italic;
    }

    /* Otimizações de Impressão (para exportar para PDF) */
    @media print {
      body {
        padding: 0;
        font-size: 11pt;
        color: #000;
      }
      h1, h2, h3, h4 {
        page-break-after: avoid;
        color: #000;
        border-color: #000;
      }
      pre, table, blockquote {
        page-break-inside: avoid;
      }
      a {
        text-decoration: none;
        color: #000;
      }
      /* Oculta URLs das âncoras na impressão */
      a[href]::after {
        content: "";
      }
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`

  writeFileSync('./documentacao_sistema_ru.html', html)
  console.log('✅ HTML gerado com sucesso em: ./documentacao_sistema_ru.html')
  console.log('💡 Dica: Abra o arquivo no navegador e aperte Ctrl+P (Salvar como PDF) para exportá-lo!')
}

main().catch(console.error)
