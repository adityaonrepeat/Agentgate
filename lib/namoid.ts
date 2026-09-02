import { createNamoIDNextClient, type NamoIDNextClient } from "@namoidhq/nextjs";

function configuredValue(raw: string | undefined): string | undefined {
  const value = raw?.trim();

  return value && !value.includes("replace_me") && !value.includes("replace-me")
    ? value
    : undefined;
}

export function namoidConfigured(): boolean {
  return Boolean(
    configuredValue(process.env.NAMOID_CLIENT_ID) &&
    configuredValue(process.env.NAMOID_CLIENT_SECRET) &&
    configuredValue(process.env.NEXT_PUBLIC_APP_URL),
  );
}

export function namoid(): NamoIDNextClient {
  const clientId = configuredValue(process.env.NAMOID_CLIENT_ID);
  const clientSecret = configuredValue(process.env.NAMOID_CLIENT_SECRET);
  const appBaseUrl = configuredValue(process.env.NEXT_PUBLIC_APP_URL);
  if (!clientId || !clientSecret || !appBaseUrl)
    throw new Error(
      "NamoID is not configured. Set NAMOID_CLIENT_ID, NAMOID_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL.",
    );

  return createNamoIDNextClient({
    clientId,
    clientSecret,
    appBaseUrl,
    callbackPath: "/api/auth/callback/namoid",
    postLoginRedirectPath: "/inbox",
    postLogoutRedirectPath: "/login",
    errorRedirectPath: "/login",
  });
}
