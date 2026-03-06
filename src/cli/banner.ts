import chalk from "chalk";

export const BANNER = `
${chalk.cyan(`   ██████╗ ██████╗ ███╗   ███╗███╗   ███╗███████╗`)}
${chalk.cyan(`  ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔════╝`)}
${chalk.cyan(`  ██║     ██║   ██║██╔████╔██║██╔████╔██║███████╗`)}
${chalk.cyan(`  ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║╚════██║`)}
${chalk.cyan(`  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║███████║`)}
${chalk.cyan(`   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚══════╝`)}
${chalk.dim(`  ────────────────────────────────────────────────`)}
${chalk.white.bold(`  Contacts`)} ${chalk.dim(`·`)} ${chalk.cyan(`Email`)} ${chalk.dim(`·`)} ${chalk.yellow(`Calls`)} ${chalk.dim(`·`)} ${chalk.magenta(`Voice`)}
${chalk.dim(`  ────────────────────────────────────────────────`)}
`;

export function printBanner(): void {
  console.log(BANNER);
}
