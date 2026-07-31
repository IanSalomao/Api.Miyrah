import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Category,
  Member,
  Ministry,
  Prisma,
  PrismaClient,
  TransactionType,
} from '../generated/prisma/client';
import { DEFAULT_CATEGORIES } from '../src/modules/categories/constants/default-categories.constant';
import { DEFAULT_MINISTRIES } from '../src/modules/ministries/constants/default-ministries.constant';

const BCRYPT_ROUNDS = 10;
const MONTHS_OF_HISTORY = 12;

const SEED_CHURCH_EMAIL = process.env.SEED_EMAIL ?? 'seed@miyrah.test';
const SEED_CHURCH_PASSWORD = process.env.SEED_PASSWORD ?? 'Miyrah@12345';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const MEMBER_SEED_DATA: Array<{
  name: string;
  birthDate?: string;
  baptismDate?: string;
  email?: string;
  phone?: string;
}> = [
  {
    name: 'Maria Aparecida Souza',
    birthDate: '1975-03-14',
    baptismDate: '1998-06-07',
    email: 'maria.souza@example.com',
    phone: '11988887701',
  },
  {
    name: 'João Pedro Lima',
    birthDate: '1968-11-02',
    baptismDate: '1990-04-15',
    email: 'joao.lima@example.com',
    phone: '11988887702',
  },
  {
    name: 'Ana Beatriz Ferreira',
    birthDate: '1990-07-22',
    baptismDate: '2010-12-25',
    email: 'ana.ferreira@example.com',
    phone: '11988887703',
  },
  {
    name: 'Carlos Eduardo Santos',
    birthDate: '1985-01-30',
    baptismDate: '2005-09-18',
    email: 'carlos.santos@example.com',
    phone: '11988887704',
  },
  {
    name: 'Juliana Costa Ribeiro',
    birthDate: '1993-05-09',
    email: 'juliana.ribeiro@example.com',
    phone: '11988887705',
  },
  {
    name: 'Roberto Carlos Almeida',
    birthDate: '1960-09-17',
    baptismDate: '1982-03-21',
    phone: '11988887706',
  },
  {
    name: 'Fernanda Oliveira Martins',
    birthDate: '1998-12-01',
    baptismDate: '2015-08-16',
    email: 'fernanda.martins@example.com',
  },
  {
    name: 'Lucas Gabriel Pereira',
    birthDate: '2001-02-28',
    email: 'lucas.pereira@example.com',
    phone: '11988887708',
  },
  {
    name: 'Patrícia Rocha Nunes',
    birthDate: '1979-06-11',
    baptismDate: '2000-01-09',
    phone: '11988887709',
  },
  {
    name: 'Marcos Vinícius Cardoso',
    birthDate: '1972-04-05',
    baptismDate: '1995-11-12',
    email: 'marcos.cardoso@example.com',
    phone: '11988887710',
  },
];

interface IncomeRecipe {
  category: string;
  countRange: [number, number];
  valueRange: [number, number];
  descriptions: string[];
  assignMember: boolean;
}

interface ExpenseRecipe {
  category: string;
  countRange: [number, number];
  valueRange: [number, number];
  descriptions: string[];
  ministry?: string;
}

const INCOME_RECIPES: IncomeRecipe[] = [
  {
    category: 'Dízimos',
    countRange: [12, 18],
    valueRange: [80, 650],
    descriptions: ['Dízimo mensal'],
    assignMember: true,
  },
  {
    category: 'Ofertas',
    countRange: [4, 5],
    valueRange: [300, 1200],
    descriptions: [
      'Oferta do culto de domingo',
      'Oferta do culto de quarta-feira',
    ],
    assignMember: false,
  },
  {
    category: 'Ofertas missionárias',
    countRange: [1, 2],
    valueRange: [100, 500],
    descriptions: ['Oferta missionária'],
    assignMember: false,
  },
  {
    category: 'Outros',
    countRange: [0, 1],
    valueRange: [50, 300],
    descriptions: ['Doação avulsa'],
    assignMember: false,
  },
];

const EXPENSE_RECIPES: ExpenseRecipe[] = [
  {
    category: 'Contas fixas',
    countRange: [1, 1],
    valueRange: [90, 140],
    descriptions: ['Conta de água'],
  },
  {
    category: 'Contas fixas',
    countRange: [1, 1],
    valueRange: [220, 420],
    descriptions: ['Conta de energia elétrica'],
  },
  {
    category: 'Contas fixas',
    countRange: [1, 1],
    valueRange: [130, 190],
    descriptions: ['Internet e telefone'],
  },
  {
    category: 'Salários',
    countRange: [1, 1],
    valueRange: [2800, 3200],
    descriptions: ['Salário pastoral'],
    ministry: 'Administração',
  },
  {
    category: 'Salários',
    countRange: [1, 1],
    valueRange: [1500, 1900],
    descriptions: ['Salário secretaria'],
    ministry: 'Administração',
  },
  {
    category: 'Aquisição de bens',
    countRange: [0, 1],
    valueRange: [150, 1800],
    descriptions: [
      'Compra de equipamento de som',
      'Compra de materiais para escola bíblica',
    ],
    ministry: 'Louvor',
  },
  {
    category: 'Obras e manutenções',
    countRange: [0, 1],
    valueRange: [200, 2500],
    descriptions: ['Manutenção predial', 'Reparo no telhado'],
  },
  {
    category: 'Outros',
    countRange: [0, 1],
    valueRange: [50, 300],
    descriptions: ['Despesa administrativa diversa'],
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function randomAmount(min: number, max: number): number {
  const cents = randomInt(Math.round(min * 100), Math.round(max * 100));
  return cents / 100;
}

function randomDateBetween(from: Date, to: Date): Date {
  const fromTime = from.getTime();
  const toTime = Math.max(to.getTime(), fromTime);
  return new Date(fromTime + Math.random() * (toTime - fromTime));
}

function buildMonthRanges(monthsBack: number): Array<{ from: Date; to: Date }> {
  const now = new Date();
  const ranges: Array<{ from: Date; to: Date }> = [];

  for (let i = monthsBack; i >= 0; i--) {
    const year = now.getFullYear();
    const month = now.getMonth() - i;
    const from = new Date(year, month, 1);
    const to = i === 0 ? now : new Date(year, month + 1, 0);
    ranges.push({ from, to });
  }

  return ranges;
}

async function cleanupPreviousSeed(): Promise<void> {
  const existing = await prisma.church.findMany({
    where: { email: SEED_CHURCH_EMAIL },
    select: { id: true },
  });
  if (existing.length === 0) {
    return;
  }

  const churchIds = existing.map((church) => church.id);

  await prisma.transaction.deleteMany({
    where: { churchId: { in: churchIds } },
  });
  await prisma.passwordResetToken.deleteMany({
    where: { churchId: { in: churchIds } },
  });
  await prisma.report.deleteMany({ where: { churchId: { in: churchIds } } });
  await prisma.ministry.deleteMany({ where: { churchId: { in: churchIds } } });
  await prisma.member.deleteMany({ where: { churchId: { in: churchIds } } });
  await prisma.category.deleteMany({ where: { churchId: { in: churchIds } } });
  await prisma.church.deleteMany({ where: { id: { in: churchIds } } });
}

async function createChurch() {
  const password = await bcrypt.hash(SEED_CHURCH_PASSWORD, BCRYPT_ROUNDS);
  return prisma.church.create({
    data: {
      name: 'Igreja Comunidade Semente (Seed)',
      email: SEED_CHURCH_EMAIL,
      password,
      phone: '11955554444',
      cnpj: '12345678000199',
      denomination: 'Batista',
    },
  });
}

async function createCategories(churchId: string): Promise<Category[]> {
  return Promise.all(
    DEFAULT_CATEGORIES.map((category) =>
      prisma.category.create({ data: { ...category, churchId } }),
    ),
  );
}

async function createMembers(churchId: string): Promise<Member[]> {
  return Promise.all(
    MEMBER_SEED_DATA.map((member) =>
      prisma.member.create({
        data: {
          churchId,
          name: member.name,
          birthDate: member.birthDate ? new Date(member.birthDate) : undefined,
          baptismDate: member.baptismDate
            ? new Date(member.baptismDate)
            : undefined,
          email: member.email,
          phone: member.phone,
        },
      }),
    ),
  );
}

async function createMinistries(
  churchId: string,
  members: Member[],
): Promise<Ministry[]> {
  return Promise.all(
    DEFAULT_MINISTRIES.map((ministry, index) =>
      prisma.ministry.create({
        data: {
          churchId,
          name: ministry.name,
          responsibleId: members[index % members.length]?.id,
        },
      }),
    ),
  );
}

async function createTransactions(
  churchId: string,
  categories: Category[],
  members: Member[],
  ministries: Ministry[],
): Promise<Prisma.TransactionCreateManyInput[]> {
  const incomeCategories = Object.fromEntries(
    categories
      .filter((category) => category.type === TransactionType.income)
      .map((category) => [category.name, category]),
  );
  const expenseCategories = Object.fromEntries(
    categories
      .filter((category) => category.type === TransactionType.expense)
      .map((category) => [category.name, category]),
  );
  const ministryByName = Object.fromEntries(
    ministries.map((ministry) => [ministry.name, ministry]),
  );

  const rows: Prisma.TransactionCreateManyInput[] = [];

  for (const { from, to } of buildMonthRanges(MONTHS_OF_HISTORY)) {
    for (const recipe of INCOME_RECIPES) {
      const category = incomeCategories[recipe.category];
      const count = randomInt(recipe.countRange[0], recipe.countRange[1]);
      for (let i = 0; i < count; i++) {
        rows.push({
          churchId,
          categoryId: category.id,
          type: TransactionType.income,
          value: randomAmount(recipe.valueRange[0], recipe.valueRange[1]),
          date: randomDateBetween(from, to),
          description: randomItem(recipe.descriptions),
          memberId: recipe.assignMember ? randomItem(members).id : undefined,
        });
      }
    }

    for (const recipe of EXPENSE_RECIPES) {
      const category = expenseCategories[recipe.category];
      const count = randomInt(recipe.countRange[0], recipe.countRange[1]);
      for (let i = 0; i < count; i++) {
        const magnitude = randomAmount(
          recipe.valueRange[0],
          recipe.valueRange[1],
        );
        rows.push({
          churchId,
          categoryId: category.id,
          type: TransactionType.expense,
          value: -magnitude,
          date: randomDateBetween(from, to),
          description: randomItem(recipe.descriptions),
          ministryId: recipe.ministry
            ? ministryByName[recipe.ministry]?.id
            : undefined,
        });
      }
    }
  }

  await prisma.transaction.createMany({ data: rows });
  return rows;
}

async function main(): Promise<void> {
  await cleanupPreviousSeed();

  const church = await createChurch();
  const categories = await createCategories(church.id);
  const members = await createMembers(church.id);
  const ministries = await createMinistries(church.id, members);
  const transactions = await createTransactions(
    church.id,
    categories,
    members,
    ministries,
  );

  const balance = transactions.reduce(
    (total, transaction) => total + Number(transaction.value),
    0,
  );

  console.log('Seed concluído com sucesso.');
  console.log('---');
  console.log(`Igreja:    ${church.name}`);
  console.log(`E-mail:    ${church.email}`);
  console.log(`Senha:     ${SEED_CHURCH_PASSWORD}`);
  console.log('---');
  console.log(`Categorias:   ${categories.length}`);
  console.log(`Membros:      ${members.length}`);
  console.log(`Ministérios:  ${ministries.length}`);
  console.log(
    `Transações:   ${transactions.length} (últimos ${MONTHS_OF_HISTORY + 1} meses)`,
  );
  console.log(`Saldo total:  R$ ${balance.toFixed(2)}`);
}

main()
  .catch((error: unknown) => {
    console.error('Falha ao rodar o seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
