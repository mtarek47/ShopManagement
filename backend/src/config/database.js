let PrismaClientClass;
try {
  const pc = require('@prisma/client');
  // Verify it is initialized
  new pc.PrismaClient();
  PrismaClientClass = pc.PrismaClient;
} catch (e1) {
  try {
    PrismaClientClass = require('../../../database/node_modules/@prisma/client').PrismaClient;
  } catch (e2) {
    try {
      PrismaClientClass = require('../../database/node_modules/@prisma/client').PrismaClient;
    } catch (e3) {
      PrismaClientClass = require('@prisma/client').PrismaClient;
    }
  }
}

const prisma = new PrismaClientClass({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
