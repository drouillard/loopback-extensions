// Copyright Shrine Development. 2019. All Rights Reserved.
// Node module: @shrinedev/loopback-gate-keycloak
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import { RequestHandler, Request, Response } from 'express';
import { KeycloakClientConfig } from './keycloak-client-config';
import { MiddlewareRunner } from '@shrinedev/middleware-runner';
import { UserProfile, Keycloak, KeycloakIdTokenContent } from './types';
import { CookieSessionStore } from './cookie-session-store';

/**
 * Keycloak Client is a modified version of the keycloak Connect package
 * that is designed to use cookies to store grants
 */

export class KeycloakClient {
    keycloak: Keycloak;

    constructor(keycloakConfig: KeycloakClientConfig) {
        
        this.keycloak = new Keycloak({}, keycloakConfig);

        // KeycloakConnect's built-in Session Store is not compatible with a fully
        // Cookie-based session. Addtionally, the KeycloakConnect Constructor takes any stores
        // provided and wraps them in another store. We avoid this by assigning to the stores directly.
        // @ts-ignore
        this.keycloak.stores.push(new CookieSessionStore());
    }

    middlewares(): Array<RequestHandler> {
        return this.keycloak.middleware() as unknown as Array<RequestHandler>;
    }

    async guard(request: Request, response: Response): Promise<any | undefined> {

        // Prepare KeycloakConnect's protect middleware
        const protect = this.keycloak.protect();

        const getUser = (request: Keycloak.GrantedRequest, response: Response, next: any) => {
            let user: UserProfile;

            const grant = request.kauth.grant;
            
            if (grant) {
                const idToken: KeycloakIdTokenContent = grant.id_token.content as KeycloakIdTokenContent;
                user = { id: idToken.sub, email: idToken.email, name: `${idToken.given_name} ${idToken.family_name}`, teams: idToken.groups };
            } else {
                throw Error("No Grant Provided");
            }
            
            return next(null, user);
        }
        
        const middlewareRunner = new MiddlewareRunner(
            CookieSessionStore.middleware.concat(this.middlewares(), protect, getUser)
        );

        const result = middlewareRunner.run(request, response);
        return result;
    }
}
