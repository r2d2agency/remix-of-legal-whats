const PLACEHOLDER_REGEX = /{{\s*(\d+)\s*}}/g;
const LANGUAGE_REGEX = /^[a-z]{2}(?:_[A-Z]{2})?$/;
const ALLOWED_CATEGORIES = new Set(['UTILITY', 'MARKETING', 'AUTHENTICATION']);

function collectPlaceholderIndexes(text = '') {
  const matcher = new RegExp(PLACEHOLDER_REGEX.source, 'g');
  const found = new Set();
  let match;

  while ((match = matcher.exec(text)) !== null) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && index > 0) {
      found.add(index);
    }
  }

  return [...found].sort((a, b) => a - b);
}

function hasSequentialPlaceholders(indexes) {
  return indexes.every((value, i) => value === i + 1);
}

function normalizeTemplateName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeComponents(components) {
  return components.map((component) => {
    const type = String(component?.type || '').toUpperCase();
    const format = component?.format ? String(component.format).toUpperCase() : undefined;

    return {
      ...component,
      type,
      ...(format ? { format } : {}),
    };
  });
}

function validateTextComponent(component) {
  return typeof component?.text === 'string' && component.text.trim().length > 0;
}

export function validateTemplateInput({ name, language, category, components }) {
  if (!Array.isArray(components) || components.length === 0) {
    return { ok: false, error: 'Componentes inválidos: envie ao menos BODY com texto.' };
  }

  const normalizedName = normalizeTemplateName(name);
  if (!normalizedName) {
    return { ok: false, error: 'Nome inválido: use letras minúsculas, números e underline.' };
  }

  if (normalizedName.length > 512) {
    return { ok: false, error: 'Nome inválido: máximo de 512 caracteres.' };
  }

  const normalizedLanguage = String(language || 'pt_BR').trim();
  if (!LANGUAGE_REGEX.test(normalizedLanguage)) {
    return { ok: false, error: 'Idioma inválido. Exemplo válido: pt_BR.' };
  }

  const normalizedCategory = String(category || 'UTILITY').trim().toUpperCase();
  if (!ALLOWED_CATEGORIES.has(normalizedCategory)) {
    return { ok: false, error: 'Categoria inválida. Use UTILITY, MARKETING ou AUTHENTICATION.' };
  }

  const normalizedComponents = normalizeComponents(components);
  const bodyComponent = normalizedComponents.find((component) => component.type === 'BODY');

  if (!bodyComponent || !validateTextComponent(bodyComponent)) {
    return { ok: false, error: 'Componente BODY é obrigatório e precisa conter texto.' };
  }

  for (const component of normalizedComponents) {
    const needsText = component.type === 'BODY' || component.type === 'FOOTER' || (component.type === 'HEADER' && component.format === 'TEXT');

    if (needsText && !validateTextComponent(component)) {
      return { ok: false, error: `Componente ${component.type} precisa conter texto.` };
    }

    if (!needsText || typeof component.text !== 'string') {
      continue;
    }

    const indexes = collectPlaceholderIndexes(component.text);

    if (indexes.length > 0 && !hasSequentialPlaceholders(indexes)) {
      return {
        ok: false,
        error: `Variáveis inválidas no ${component.type}: use sequência contínua {{1}}, {{2}}, {{3}}...`,
      };
    }

    if (component.type === 'HEADER' && indexes.length > 1) {
      return {
        ok: false,
        error: 'HEADER suporta no máximo uma variável ({{1}}).',
      };
    }
  }

  return {
    ok: true,
    normalizedName,
    normalizedLanguage,
    normalizedCategory,
    normalizedComponents,
  };
}

export function buildComponentsWithExamples(components) {
  return components.map((component) => {
    const isTextTemplateComponent = component.type === 'BODY' || (component.type === 'HEADER' && component.format === 'TEXT');

    if (!isTextTemplateComponent || typeof component.text !== 'string') {
      return component;
    }

    const indexes = collectPlaceholderIndexes(component.text);
    if (indexes.length === 0) {
      return component;
    }

    const exampleValues = indexes.map((index) => `exemplo_${index}`);

    if (component.type === 'BODY') {
      return {
        ...component,
        example: {
          ...(component.example || {}),
          body_text: [exampleValues],
        },
      };
    }

    return {
      ...component,
      example: {
        ...(component.example || {}),
        header_text: exampleValues,
      },
    };
  });
}
