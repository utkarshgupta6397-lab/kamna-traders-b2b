import { prisma } from './src/lib/db';

async function main() {
  const steps = await prisma.solarWorkflowStep.findMany({
    where: { workflowType: 'INSTALLATION' },
    take: 5
  });
  console.log("Steps:", JSON.stringify(steps, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
