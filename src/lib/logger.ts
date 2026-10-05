/**
 * Güvenli günlük — kullanıcı verisi ASLA yazılmaz.
 * Yalnız sabit, genel durum mesajları.
 */

type Level = 'info' | 'warn' | 'error';

const PREFIX = '[arac]';

function write(level: Level, message: string): void {
  // Yalnız sabit string; argümanlarda kullanıcı içeriği yok.
  const line = `${PREFIX} ${message}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string) => write('error', message),
};
