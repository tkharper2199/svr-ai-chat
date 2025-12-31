/**
 * Type for principal for the authentication system.
 */
export interface Principal {
  userId: string;
}

// Default principal for development mode
let defaultPrincipal: Principal = { 
    userId: "test@test.com" 
};
let defaultPrincipalString = JSON.stringify(defaultPrincipal);

/**
 * Authenticates a client based on the provided token/returns their principal.
 * In development mode, it uses a predefined user identity from environment variables (or a hardcoded default).
 * @param token JWT (eventually other) tokens.
 * @returns Principal of the requet.
 */
export function authenticateClient(token: string | undefined): Principal | null {
    if (process.env.NODE_ENV === "development") {
        
        return JSON.parse(process.env.DEV_USER_IDENTITY || defaultPrincipalString);
    }
    // TODO - Implement real authentication logic here.
    return null;
}