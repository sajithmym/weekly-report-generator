const { Test } = require("@nestjs/testing");
const { ValidationPipe } = require("@nestjs/common");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { AppModule } = require("../../src/app.module");
const { PrismaService } = require("../../src/database/prisma.service");
const { GlobalExceptionFilter } = require("../../src/common/filters");
const { AUTH_SETTINGS, SERVER_SETTINGS } = require("../../src/settings");

/** Exercise the HTTP boundary with real guards, validation, cookies and PostgreSQL. */
async function createTestApp() {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: SERVER_SETTINGS.frontendUrl,
    credentials: true,
    methods: SERVER_SETTINGS.cors.methods,
    allowedHeaders: [
      ...SERVER_SETTINGS.cors.allowedHeaders,
      AUTH_SETTINGS.csrfHeaderName,
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return { app, http: app.getHttpServer(), prisma: app.get(PrismaService) };
}

module.exports = { createTestApp };
