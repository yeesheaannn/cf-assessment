export default {
	// This function runs every time someone makes a request to the Worker.
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// Get Identity and Location Data
		const email = request.headers.get("Cf-Access-Authenticated-User-Email") || "Unknown User";
		// Cloudflare automatically attaches the visitor's country code (e.g., "MY", "US") to the request.
		const country = request.cf?.country || "Unknown";
		// The current time is captured so it can be displayed when the user was authenticated.
		const timestamp = new Date().toISOString();

		// Route A: Serve the Flag Image
		// Example path: /secure/MY (or whatever country code).
		// This branch returns the country flag image from R2.
		if (url.pathname.includes("/secure/") && url.pathname !== "/secure") {
			// 1. Get the country code (e.g. "MY")
			const requestedCountry = url.pathname.split("/").pop();
			
			// 2. Convert to lowercase and add .svg (because the repo uses "my.svg")
			const imageKey = `${requestedCountry?.toLowerCase()}.svg`;

			// 3. Fetch from R2
			const object = await env.ASSETS_BUCKET.get(imageKey);

			if (object === null) {
				return new Response("Flag not found in R2", { status: 404 });
			}

			// 4. Return as SVG
			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set("etag", object.httpEtag);
			headers.set("content-type", "image/svg+xml");

			// `object.body` is the actual file content that the browser will download.
			return new Response(object.body, {
				headers,
			});
		}

		// Route B: Serve the HTML Page
		// Path: /secure
		// This branch shows a simple HTML page that links to the flag route above.
		if (url.pathname === "/secure" || url.pathname === "/secure/") {
			// A small HTML string is built directly in the Worker.
			const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Secure Assessment</title>
        <style>body { font-family: sans-serif; padding: 2rem; }</style>
      </head>
      <body>
        <h1>Identity Verified</h1>
        <p>
          <strong>${email}</strong> authenticated at ${timestamp} from 
          <a href="/secure/${country}">${country}</a>
        </p>
      </body>
      </html>
      `;

			// The HTML is sent back with a "text/html" content type so the browser renders it.
			return new Response(html, {
				headers: {
					"content-type": "text/html;charset=UTF-8",
				},
			});
		}

		// Fallback for any other paths that don't match the routes above.
		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;