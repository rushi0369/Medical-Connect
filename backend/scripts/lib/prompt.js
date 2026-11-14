import readline from 'node:readline/promises';

/** Asks a question in the terminal and shows what is typed. */
export async function askVisible(question) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await prompt.question(question)).trim();
  } finally {
    prompt.close();
  }
}

/** Asks for a secret. Only * symbols appear on screen. Resolves to null on Ctrl+C. */
export function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;

    if (!stdin.isTTY) {
      resolve(null);
      return;
    }

    let value = '';

    const finish = (result) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      resolve(result);
    };

    function onData(chunk) {
      for (const character of chunk) {
        if (character === '\r' || character === '\n') return finish(value);
        if (character === '\u0003') return finish(null); // Ctrl+C
        if (character === '\b' || character === '\u007f') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
        } else if (character >= ' ') {
          value += character;
          stdout.write('*');
        }
      }
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
}
