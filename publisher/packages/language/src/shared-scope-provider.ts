import { AstUtils, DefaultScopeProvider, ReferenceInfo, Scope } from 'langium';
import { AdministratorGameApprovalRequestType } from './generated/ast.js';

export class SharedScopeProvider extends DefaultScopeProvider {
    override getScope(context: ReferenceInfo): Scope {
        
        const referenceType = this.reflection.getReferenceType(context);
        // When resolving version references in game approval requests, limit the scope to versions of the referenced game
        if (referenceType === 'AdministratorVersionType' && context.container.$type === 'AdministratorGameApprovalRequestType' ) {
            // Find the containing Request
            const request = AstUtils.getContainerOfType(
                context.container, 
                (node): node is AdministratorGameApprovalRequestType => node.$type === 'AdministratorGameApprovalRequestType',
            );
            
            if (request?.game?.ref) {
                // Return scope containing only columns from the referenced table
                const versions = request.game.ref.versions;
                return this.createScopeForNodes(versions);
            }
        }
        
        return super.getScope(context);
    }
}