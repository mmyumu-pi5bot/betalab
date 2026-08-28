// Values a message placeholder can carry. Numbers are rendered with the lab's
// dot decimal separator in every locale: the readouts mirror instrument
// displays, and a comma separator would also have to be parsed back out of the
// quantity inputs.
export type MessageValue = string | number;

export type MessageParams = Record<string, MessageValue>;

const placeholderPattern = /\{(\w+)\}/g;

export function interpolate(template: string, params?: MessageParams): string {
  if (!params) {
    return template;
  }
  return template.replace(placeholderPattern, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
