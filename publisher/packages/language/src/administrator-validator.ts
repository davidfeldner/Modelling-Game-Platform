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
        const saleStart = this.services.util.UtilService.parseDate(sale.start_date);
        const saleEnd = this.services.util.UtilService.parseDate(sale.end_date);
        if (saleStart > saleEnd) {
            accept('error', 'Sale end must be after sale start', { node: sale });
        }
        
        for (const discount of sale.discounts) {      
            const discountStart = this.services.util.UtilService.parseDate(discount.ref.start_date);
            const discountEnd = this.services.util.UtilService.parseDate(discount.ref.end_date);

            if (discountStart < saleStart || discountEnd > saleEnd) {
                accept('error', 'Sale must only have games with discounts in sale period', { node: sale });
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
                { path: 'requests[*].status', exactMatch: true },
                { path: 'sales[*]', exactMatch: false },
                { path: 'games[*].reviews[*].is_flagged', exactMatch: true },
            ];
            this.services.util.UtilService.assertNoUnauthorizedChanges(model, dbModel, accept, model, allowed);
    }
}
