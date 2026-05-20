import { type ValidationAcceptor, type ValidationChecks } from 'langium';
import { type PublisherAstType, AdministratorModel, AdministratorSaleType } from './generated/ast.js';
import type { SharedServices } from './shared-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecksAdministrator(services: SharedServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.AdministratorValidator;
    const checks: ValidationChecks<PublisherAstType> = {
        AdministratorSaleType: validator.checkSaleOnlyHasDiscountsWithinSalePeriod,
        AdministratorModel: validator.checkNoUnauthorizedChanges,
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 * 
 * Administrator allowed actions: 
 * - flag game reviews
 * - create sales with discounts
 * - change status for game approval request
 */
export class AdministratorValidator {
    constructor(private services: SharedServices) { }

    checkSaleOnlyHasDiscountsWithinSalePeriod(sale: AdministratorSaleType, accept: ValidationAcceptor): void {
        const saleStart = new Date(sale.start_date);
        const saleEnd = new Date(sale.end_date);
        
        for (const discount of sale.discounts) {      
            const discountStart = new Date(discount.ref.start_date);
            const discountEnd = new Date(discount.ref.end_date);

            if (discountStart < saleStart || discountEnd > saleEnd) {
                accept('error', 'Sale must only have games with discounts in sale period', { node: discount.ref });
                break;
            }
        }
    }

    checkNoUnauthorizedChanges(model: AdministratorModel, accept: ValidationAcceptor): void {
            const db = this.services.db.DatabaseService.getDBSnapshot("administrator", model.administrator.name);
            if (db === undefined) {
                accept('warning', 'Could not check cached data. Try pulling first.', { node: model });
                return;
            }
    
            const dbModel = this.services.util.UtilService.buildAdministratorModelFromDBModel(db, model.administrator.name);
            const allowed = [
                'requests[*].status',
                'sales[*]',
                'games[*].reviews[*].is_flagged',
            ];
            this.services.util.UtilService.assertNoUnauthorizedChanges(model, dbModel, allowed, accept, model);
    }
}
