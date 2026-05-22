<h1 align="center">🌳 FileTree Generator</h1>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/-TypeScript-3178C6?style=flat&logo=typescript&logoColor=white">
  <img alt="Linux" src="https://img.shields.io/badge/-Linux-FCC624?style=flat&logo=linux&logoColor=black">
  <img alt="Node.js" src="https://img.shields.io/badge/-Node.js-339933?style=flat&logo=nodedotjs&logoColor=white">
  <br>
  <strong>Cria diretórios e arquivos a partir de uma árvore textual.</strong><br>
  Feito para Linux, escrito em TypeScript.
</p>

---

## 🧠 O que é?

Uma ferramenta que transforma uma estrutura de texto (daquelas copiadas do `tree`) em pastas e arquivos reais no seu sistema, sem CLI, sem colar nada, sem risco de apagar dados existentes.

---

## ⚡ Instalação

```bash
git clone https://github.com/kx7-io/filetree-generator.git
cd filetree-generator
npm install
```

---

## 🚀 Uso

1. Edite o arquivo `estrutura.txt` com a árvore desejada.
2. Execute:

```bash
npx tsx filetree.ts
```

A estrutura será criada em `~/Documentos` (padrão).

> Para usar outra base, acrescente a linha `#base:downloads` no topo do `estrutura.txt`.  
> Opções: `documents`, `downloads`, `desktop`.

---

## 📝 Formato do arquivo

```
yeto-gateway/
├── .env
├── src/
│   ├── index.ts
│   └── utils/
│       └── helper.ts
└── package.json
```

- **Diretórios** terminam com `/`
- A indentação usa `├──`, `└──` e `│   `
- Texto extra após a extensão é removido automaticamente
- O parser entende múltiplos níveis de hierarquia

---

## 🛡️ Segurança

- **Nunca apaga nem sobrescreve** arquivos ou pastas
- Proteção contra travessia de diretório
- Utiliza flags seguras (`wx`) e verificação de existência

---

## 📄 Licença

MIT — faça o que quiser, apenas mantenha os créditos.

---

<p align="center">Feito com ❤️ por <strong>Nyx7</strong></p>
