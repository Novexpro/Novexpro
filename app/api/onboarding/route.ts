import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../utils/prisma';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    console.log('⏳ Onboarding API called');
    
    // Get request body first to check for test flag
    const body = await req.json();
    console.log('📝 Request body:', JSON.stringify(body, null, 2));
    
    let userId: string | null = null;
    
    // Check if this is a test request with a specified userId
    if (body.userId && body.isTestRequest) {
      console.log('🧪 Test request detected, using provided userId:', body.userId);
      userId = body.userId;
    } else {
      // Regular authentication flow
      const authResult = await auth();
      console.log('🔑 Auth result:', authResult);
      userId = authResult.userId;
      
      if (!userId) {
        console.log('❌ No user ID found');
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('✓ Using User ID:', userId);
    
    const { companyName, businessType, role, phoneNumber, pincode, gstin, interestedMetals } = body;

    // Validate required fields
    const requiredFields = {
      companyName,
      businessType,
      role,
      phoneNumber,
      pincode,
      gstin
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.log('❌ Missing fields:', missingFields);
      return NextResponse.json(
        { 
          success: false,
          message: 'Missing required fields',
          missingFields
        },
        { status: 400 }
      );
    }

    if (!interestedMetals || interestedMetals.length === 0) {
      console.log('❌ No metals selected');
      return NextResponse.json(
        { 
          success: false,
          message: 'Please select at least one metal'
        },
        { status: 400 }
      );
    }

    // Validate GSTIN format (basic check)
    if (gstin.length !== 15) {
      console.log('❌ Invalid GSTIN length:', gstin.length);
      return NextResponse.json(
        { 
          success: false,
          message: 'GSTIN must be 15 characters long'
        },
        { status: 400 }
      );
    }

    // Validate phone number
    if (phoneNumber.length < 10) {
      console.log('❌ Invalid phone number length:', phoneNumber.length);
      return NextResponse.json(
        { 
          success: false,
          message: 'Phone number must be at least 10 digits'
        },
        { status: 400 }
      );
    }

    console.log('⏳ Attempting to save to database with userId:', userId);
    
    try {
      // Store or update data in the database
      const formEntry = await prisma.onboarding.upsert({
        where: { userId },
        update: {
          companyName,
          businessType,
          role,
          phoneNumber,
          pincode,
          gstin,
          interestedMetals,
        },
        create: {
          userId,
          companyName,
          businessType,
          role,
          phoneNumber,
          pincode,
          gstin,
          interestedMetals,
        },
      });
      
      console.log('✅ Data saved successfully:', formEntry);

      return NextResponse.json({ 
        success: true, 
        data: formEntry 
      });
    } catch (dbError) {
      console.error('💾 Database error:', dbError);
      return NextResponse.json(
        { 
          success: false,
          message: 'Database error',
          error: dbError instanceof Error ? dbError.message : 'Unknown database error',
          details: dbError
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('🔥 Error saving form data:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}