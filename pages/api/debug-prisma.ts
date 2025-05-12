import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

// Create a new instance of the PrismaClient
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get all available model names in the Prisma client
    const modelNames = Object.keys(prisma);
    
    // Filter out non-model properties
    const properModelNames = modelNames.filter(name => 
      name !== '$connect' && 
      name !== '$disconnect' && 
      name !== '$on' && 
      name !== '$transaction' &&
      name !== '$use' &&
      name !== '$extends' &&
      !name.startsWith('_')
    );
    
    // Log info about each model - with proper typing
    const modelInfo: Record<string, string> = {};
    for (const modelName of properModelNames) {
      modelInfo[modelName] = typeof prisma[modelName as keyof typeof prisma];
    }
    
    // Return success with model info
    res.status(200).json({ 
      success: true, 
      modelNames: properModelNames,
      modelInfo
    });
  } catch (error) {
    console.error('Error inspecting Prisma client:', error);
    
    // Return error
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await prisma.$disconnect();
  }
} 