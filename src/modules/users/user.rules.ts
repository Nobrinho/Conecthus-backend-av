/**
 * Regras de validação do cadastro de usuário, em um único lugar.
 *
 * Vêm do enunciado da avaliação ("Nome apenas letras", "Matrícula apenas
 * números", "Senha alfanumérica de 6 dígitos") somadas aos limites que o
 * protótipo mostra embaixo de cada campo. O frontend repete exatamente estas
 * regras para validar enquanto a pessoa digita; o backend é quem garante.
 */
export const USER_RULES = {
  name: {
    maxLength: 30,
    /** Letras (inclusive acentuadas) separadas por um único espaço. */
    pattern: /^\p{L}+(?: \p{L}+)*$/u,
    message: 'O nome deve conter apenas letras',
    /** "Nome Completo": ao menos nome e sobrenome. */
    fullNamePattern: /^\p{L}+(?: \p{L}+)+$/u,
    fullNameMessage: 'Informe o nome completo (nome e sobrenome)',
  },
  email: {
    maxLength: 40,
  },
  registration: {
    minLength: 4,
    maxLength: 10,
    pattern: /^\d+$/,
    message: 'A matrícula deve conter apenas números',
  },
  password: {
    length: 6,
    pattern: /^[A-Za-z0-9]{6}$/,
    message: 'A senha deve ter exatamente 6 caracteres alfanuméricos',
  },
} as const;
