import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import {
  PIPELINE_DEFAULT,
  normalizeCompanyName,
  scoreTemperature,
} from "@orbixlead/shared";
import { PrismaClient, Role, Temperature } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

const prisma = new PrismaClient();

const tempFromScore: Record<string, Temperature> = {
  frio: Temperature.FRIO,
  morno: Temperature.MORNO,
  quente: Temperature.QUENTE,
};

async function main() {
  // CONF-02: o seed é DESTRUTIVO (apaga e recria dados) e cria usuários com senhas
  // conhecidas. Nunca deve rodar em produção por engano. Exige ALLOW_SEED=1 para tal.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    console.error(
      "[seed] ABORTADO: NODE_ENV=production. O seed apaga dados e cria contas de demo.\n" +
        "Se realmente pretende semear em produção, defina ALLOW_SEED=1 explicitamente."
    );
    process.exit(1);
  }

  const superEmail = (process.env.SEED_SUPER_ADMIN_EMAIL || "admin@orbixlead.local").toLowerCase();
  const superPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || "Orbixlead@Admin123";
  const demoAdminEmail = (process.env.SEED_DEMO_ADMIN_EMAIL || "demo@orbixlead.local").toLowerCase();
  const demoAdminPassword = process.env.SEED_DEMO_ADMIN_PASSWORD || "Orbixlead@Demo123";
  const demoOpEmail = (process.env.SEED_DEMO_OPERADOR_EMAIL || "operador@orbixlead.local").toLowerCase();
  const demoOpPassword = process.env.SEED_DEMO_OPERADOR_PASSWORD || "Orbixlead@Oper123";

  console.log("Seeding Orbixlead...");

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.scrapingResult.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.scrapingJob.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.creditLedger.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const superHash = await bcrypt.hash(superPassword, 12);
  const superAdmin = await prisma.user.create({
    data: {
      email: superEmail,
      name: "Super Admin",
      passwordHash: superHash,
      role: Role.SUPER_ADMIN,
    },
  });

  const cycleEndsAt = new Date();
  cycleEndsAt.setDate(cycleEndsAt.getDate() + 30);

  const tenant = await prisma.tenant.create({
    data: {
      name: "Demo Orbixlead",
      unlimited: false,
      creditCap: 1500,
      creditRemaining: 1284,
      cycleEndsAt,
      avgLeadCost: 2.5,
      pipelineStages: {
        create: PIPELINE_DEFAULT.map((s) => ({
          slug: s.slug,
          label: s.label,
          position: s.position,
        })),
      },
    },
    include: { pipelineStages: true },
  });

  await prisma.creditLedger.create({
    data: {
      tenantId: tenant.id,
      type: "GRANT",
      amount: 1500,
      balanceAfter: 1500,
      createdById: superAdmin.id,
      note: "Pacote seed 1500",
    },
  });
  await prisma.creditLedger.create({
    data: {
      tenantId: tenant.id,
      type: "RESERVE",
      amount: 216,
      balanceAfter: 1284,
      note: "Consumo demonstrativo do ciclo",
    },
  });
  await prisma.creditLedger.create({
    data: {
      tenantId: tenant.id,
      type: "SETTLE",
      amount: 200,
      balanceAfter: 1284,
      note: "Settle demonstrativo",
    },
  });
  await prisma.creditLedger.create({
    data: {
      tenantId: tenant.id,
      type: "RELEASE",
      amount: 16,
      balanceAfter: 1284,
      note: "Release demonstrativo (já refletido no saldo)",
    },
  });

  const adminHash = await bcrypt.hash(demoAdminPassword, 12);
  const demoAdmin = await prisma.user.create({
    data: {
      email: demoAdminEmail,
      name: "Demo Admin",
      passwordHash: adminHash,
      role: Role.ADMIN,
      tenantId: tenant.id,
    },
  });

  const opHash = await bcrypt.hash(demoOpPassword, 12);
  const demoOp = await prisma.user.create({
    data: {
      email: demoOpEmail,
      name: "Demo Operador",
      passwordHash: opHash,
      role: Role.OPERADOR,
      tenantId: tenant.id,
    },
  });

  const stageBySlug = Object.fromEntries(tenant.pipelineStages.map((s) => [s.slug, s]));

  await prisma.messageTemplate.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: "Primeiro contato",
        body: "Olá! Vi a {empresa} e gostaria de conversar sobre como podemos ajudar. Posso te ligar?",
      },
      {
        tenantId: tenant.id,
        name: "Follow-up WhatsApp",
        body: "Oi {nome}, passando para retomar o contato com a {empresa}. Ainda faz sentido conversarmos?",
      },
    ],
  });

  const leadDefs = [
    {
      companyName: "Padaria Sol Nascente",
      phoneE164: "+5511999900001",
      city: "São Paulo",
      state: "SP",
      website: null as string | null,
      rating: 4.2,
      reviewCount: 8,
      segment: "padarias",
      stage: "new",
      socialUrls: [] as string[],
    },
    {
      companyName: "Clínica Vida Plena",
      phoneE164: "+5511999900002",
      city: "São Paulo",
      state: "SP",
      website: "https://vidaplena.example",
      rating: 4.8,
      reviewCount: 120,
      segment: "clinicas",
      stage: "contacted",
      socialUrls: ["https://instagram.com/vidaplena"],
    },
    {
      companyName: "Auto Peças Norte",
      phoneE164: "+5511999900003",
      city: "Campinas",
      state: "SP",
      website: null,
      rating: 3.9,
      reviewCount: 5,
      segment: "autopecas",
      stage: "scheduled",
      socialUrls: [],
    },
    {
      companyName: "Studio Beleza Rare",
      phoneE164: "+5511999900004",
      city: "São Paulo",
      state: "SP",
      website: null,
      rating: 4.6,
      reviewCount: 35,
      segment: "beleza",
      stage: "follow_up",
      socialUrls: ["https://instagram.com/belzarare"],
    },
    {
      companyName: "TechFix Informática",
      phoneE164: "+5511999900005",
      city: "Guarulhos",
      state: "SP",
      website: "https://techfix.example",
      rating: 4.9,
      reviewCount: 80,
      segment: "informatica",
      stage: "converted",
      socialUrls: ["https://facebook.com/techfix"],
    },
    {
      companyName: "Marmoraria Ideal",
      phoneE164: "+5511999900006",
      city: "Osasco",
      state: "SP",
      website: null,
      rating: 4.0,
      reviewCount: 3,
      segment: "marmorarias",
      stage: "lost",
      socialUrls: [],
    },
    {
      companyName: "Pet Shop Amigo Fiel",
      phoneE164: "+5511999900007",
      city: "São Paulo",
      state: "SP",
      website: "https://amigofiel.example",
      rating: 4.3,
      reviewCount: 22,
      segment: "petshops",
      stage: "new",
      socialUrls: [],
    },
    {
      companyName: "Academia Força Total",
      phoneE164: "+5511999900008",
      city: "Santo André",
      state: "SP",
      website: null,
      rating: 4.7,
      reviewCount: 55,
      segment: "academias",
      stage: "contacted",
      socialUrls: ["https://instagram.com/forcatotal"],
    },
  ];

  const createdLeads = [];
  for (const def of leadDefs) {
    const hasWebsite = Boolean(def.website);
    const temperature = tempFromScore[
      scoreTemperature({
        rating: def.rating,
        reviewCount: def.reviewCount,
        hasWebsite,
        socialCount: def.socialUrls.length,
      })
    ];
    const lead = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        stageId: stageBySlug[def.stage].id,
        companyName: def.companyName,
        companyNameNormalized: normalizeCompanyName(def.companyName),
        phoneE164: def.phoneE164,
        temperature,
        rating: def.rating,
        reviewCount: def.reviewCount,
        city: def.city,
        state: def.state,
        country: "BR",
        website: def.website,
        mapsUrl: `https://www.google.com/maps/place/${encodeURIComponent(def.companyName)}`,
        socialUrls: def.socialUrls,
        hasWebsite,
        segment: def.segment,
      },
    });
    createdLeads.push(lead);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const monthly = await prisma.goal.create({
    data: {
      tenantId: tenant.id,
      name: "Conversões mensais — SP",
      periodType: "MONTHLY",
      scope: "COMPANY",
      year,
      month,
      targetConversions: 40,
      precoVenda: 800,
      custoPorConversao: 2.5,
    },
  });

  await prisma.goal.create({
    data: {
      tenantId: tenant.id,
      name: "Semana 1",
      periodType: "WEEKLY",
      parentId: monthly.id,
      year,
      month,
      week: 1,
      targetConversions: 10,
      precoVenda: 800,
      custoPorConversao: 2.5,
    },
  });

  await prisma.goal.create({
    data: {
      tenantId: tenant.id,
      name: "Dia 1",
      periodType: "DAILY",
      parentId: monthly.id,
      year,
      month,
      day: 1,
      targetConversions: 2,
      precoVenda: 800,
      custoPorConversao: 2.5,
    },
  });

  const scheduledLead = createdLeads.find((l) => l.companyName === "Auto Peças Norte")!;
  const followLead = createdLeads.find((l) => l.companyName === "Studio Beleza Rare")!;

  await prisma.schedule.createMany({
    data: [
      {
        tenantId: tenant.id,
        leadId: scheduledLead.id,
        scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        reason: "Demonstração do produto",
        notes: "Confirmar horário pela manhã",
        createdById: demoAdmin.id,
      },
      {
        tenantId: tenant.id,
        leadId: followLead.id,
        scheduledAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        reason: "Follow-up proposta",
        createdById: demoOp.id,
      },
      {
        tenantId: tenant.id,
        leadId: createdLeads[0].id,
        scheduledAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        reason: "Primeira ligação",
        createdById: demoAdmin.id,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: demoAdmin.id,
        title: "Créditos em atenção",
        body: "Seu saldo de créditos está abaixo de 90% do teto do ciclo.",
      },
      {
        userId: demoAdmin.id,
        title: "Captura concluída",
        body: "Job em São Paulo/padarias finalizou com 12 leads novos.",
        readAt: new Date(now.getTime() - 3600_000),
      },
      {
        userId: demoOp.id,
        title: "Bem-vindo",
        body: "Você pode usar Captura e CRM neste tenant demo.",
      },
      {
        userId: superAdmin.id,
        title: "Tenant demo pronto",
        body: "O tenant Demo Orbixlead foi criado com seed rico.",
      },
    ],
  });

  console.log("Seed OK");
  console.log({
    superAdmin: superEmail,
    demoAdmin: demoAdminEmail,
    demoOperador: demoOpEmail,
    tenant: tenant.name,
    leads: createdLeads.length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
