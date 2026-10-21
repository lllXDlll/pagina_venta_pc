import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ENTORNO, type Entorno } from '../config/entorno.js';

const COOKIE = 'diagnostico';

/** Lee una cookie del encabezado sin depender de cookie-parser (módulo temporal). */
function leerCookie(req: Request, nombre: string): string | undefined {
  for (const par of req.headers.cookie?.split(';') ?? []) {
    const [clave, ...valor] = par.trim().split('=');
    if (clave === nombre) return decodeURIComponent(valor.join('='));
  }
  return undefined;
}

/**
 * TEMPORAL (Sprint 0, HU-36b). Se elimina en un commit propio al terminar la validación.
 * Comprueba la cookie entre app. y api. y la IP real del cliente detrás del proxy de Render.
 */
@Controller('diagnostico')
export class DiagnosticoController {
  constructor(@Inject(ENTORNO) private readonly entorno: Entorno) {}

  /** 1.ª llamada: emite la cookie. 2.ª llamada con credenciales: confirma que volvió. */
  @Get('cookie')
  cookie(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const recibida = leerCookie(req, COOKIE);
    if (recibida) return { recibida: true, valor: recibida };

    const valor = new Date().toISOString();
    const produccion = this.entorno.cookieDomain !== '';
    res.cookie(COOKIE, valor, {
      httpOnly: true,
      sameSite: 'lax',
      // En local (http, sin dominio) la cookie va sin Secure ni Domain, como la sesión real
      secure: produccion,
      domain: produccion ? this.entorno.cookieDomain : undefined,
      maxAge: 10 * 60 * 1000,
    });
    return { recibida: false, emitida: valor };
  }

  @Get('ip')
  ip(@Req() req: Request) {
    return {
      ip: req.ip,
      ips: req.ips,
      trustProxyHops: this.entorno.trustProxyHops,
      remoteAddress: req.socket.remoteAddress,
      xForwardedFor: req.headers['x-forwarded-for'] ?? null,
      xRealIp: req.headers['x-real-ip'] ?? null,
      cfConnectingIp: req.headers['cf-connecting-ip'] ?? null,
    };
  }
}
