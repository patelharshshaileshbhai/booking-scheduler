import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

type AuthUser = {
  id: string;
  email: string;
};

type AccessTokenPayload = JwtPayload & {
  sub: string;
  email: string;
};

function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_ACCESS_SECRET as string,
    {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'],
    }
  );
}

function requireAuth(req: Request, res: Response, next: NextFunction): Response | void {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as AccessTokenPayload;
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export { signAccessToken, requireAuth };