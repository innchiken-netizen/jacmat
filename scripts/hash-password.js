#!/usr/bin/env node
/**
 * JACMAT STORE — Admin Password Hasher Utility
 * Generates a bcrypt hash (cost 12) for ADMIN_PASSWORD_HASH in .env.local
 */

import bcrypt from "bcryptjs";
import readline from "readline";

const BCRYPT_ROUNDS = 12;

async function hashPassword(plainText) {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return await bcrypt.hash(plainText, salt);
}

const argPassword = process.argv[2];

if (argPassword) {
  processPassword(argPassword);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("Entrez le mot de passe administrateur à hacher : ", async (answer) => {
    rl.close();
    if (!answer || answer.trim().length < 6) {
      console.error("\nErreur : Le mot de passe doit comporter au moins 6 caractères.\n");
      process.exit(1);
    }
    await processPassword(answer.trim());
  });
}

async function processPassword(password) {
  console.log("\n[JACMAT] Génération du hachage bcrypt (coût 12)...");
  const hash = await hashPassword(password);
  console.log("\n=======================================================");
  console.log("Copiez cette valeur dans votre fichier .env.local :");
  console.log("=======================================================");
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
}
