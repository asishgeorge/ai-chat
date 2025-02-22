import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Define a default user
  const defaultUser = await prisma.user.upsert({
    where: { email: 'default@example.com' },
    update: {}, // If the user already exists, do nothing
    create: {
      email: 'default@example.com',
    },
  });

  console.log('Seeding completed:', defaultUser);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
