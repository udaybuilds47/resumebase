import { NextRequest, NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("gmail_rt", "", { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}


