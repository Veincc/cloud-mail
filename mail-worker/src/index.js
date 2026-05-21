import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import kvObjService from './service/kv-obj-service';
import oauthService from "./service/oauth-service";
import analysisService from './service/analysis-service';
export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		const accessResp = checkHttpAccess(req, env);
		if (accessResp) {
			return accessResp;
		}

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		 if (['/static/','/attachments/'].some(p => url.pathname.startsWith(p))) {
			 return await kvObjService.toObjResp( { env }, url.pathname.substring(1));
		 }

		return env.assets.fetch(req);
	},
	email: email,
	async scheduled(c, env, ctx) {
		if (c.cron === '*/30 * * * *') {
			await analysisService.refreshEchartsCache({ env })
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await oauthService.clearNoBindOathUser({ env })
		await analysisService.refreshEchartsCache({ env })
	},
};

function checkHttpAccess(req, env) {
	const mode = (env.frontend_access || 'open').toLowerCase();

	if (mode === 'open') {
		return null;
	}

	if (mode === 'closed') {
		return new Response(null, { status: 204 });
	}

	if (mode !== 'ip') {
		return null;
	}

	const allowList = parseAllowList(env.frontend_ip_allowlist);

	if (allowList.length === 0) {
		return new Response('Forbidden', { status: 403 });
	}

	const clientIp = getClientIp(req);

	if (allowList.includes(clientIp)) {
		return null;
	}

	return new Response('Forbidden', { status: 403 });
}

function parseAllowList(value = '') {
	return value
		.split(',')
		.map(item => item.trim())
		.filter(Boolean);
}

function getClientIp(req) {
	return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '';
}
