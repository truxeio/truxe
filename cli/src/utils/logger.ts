import chalk from 'chalk';

export class Logger {
  private verbose: boolean;

  constructor() {
    this.verbose = process.env.TRUXE_VERBOSE === 'true';
  }

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray('🐛'), chalk.gray(message));
    }
  }

  log(message: string): void {
    console.log(message);
  }

  blank(): void {
    console.log();
  }

  // Styled messages
  header(message: string): void {
    console.log(chalk.bold.blue(message));
  }

  subheader(message: string): void {
    console.log(chalk.bold(message));
  }

  dim(message: string): void {
    console.log(chalk.dim(message));
  }

  highlight(message: string): void {
    console.log(chalk.cyan(message));
  }

  // Progress and status
  step(step: number, total: number, message: string): void {
    const progress = chalk.dim(`[${step}/${total}]`);
    console.log(`${progress} ${message}`);
  }

  bullet(message: string): void {
    console.log(`  • ${message}`);
  }

  indent(message: string, level: number = 1): void {
    const spaces = '  '.repeat(level);
    console.log(`${spaces}${message}`);
  }

  // Tables and lists
  table(data: Array<{ key: string; value: string; status?: 'success' | 'error' | 'warning' }>): void {
    const maxKeyLength = Math.max(...data.map(row => row.key.length));
    
    data.forEach(row => {
      const key = row.key.padEnd(maxKeyLength);
      const statusIcon = row.status === 'success' ? chalk.green('✓') 
                        : row.status === 'error' ? chalk.red('✗')
                        : row.status === 'warning' ? chalk.yellow('⚠')
                        : ' ';
      
      console.log(`${statusIcon} ${chalk.dim(key)} ${row.value}`);
    });
  }

  list(items: string[], ordered: boolean = false): void {
    items.forEach((item, index) => {
      const prefix = ordered ? `${index + 1}.` : '•';
      console.log(`  ${prefix} ${item}`);
    });
  }

  // Boxes and separators
  box(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    
    const color = colors[type];
    const border = color('─'.repeat(message.length + 4));
    
    console.log(border);
    console.log(color(`│ ${message} │`));
    console.log(border);
  }

  separator(): void {
    console.log(chalk.dim('─'.repeat(50)));
  }

  // Command output
  command(command: string): void {
    console.log(chalk.dim('$'), chalk.cyan(command));
  }

  commandOutput(output: string): void {
    console.log(chalk.dim(output));
  }
}
