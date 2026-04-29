import { AstUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { isAdministratorDiscountType, type PublisherAstType, type AdministratorDiscountType, AdministratorSaleType } from './generated/ast.js';
import type { SharedServices } from './shared-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecksAdministrator(services: SharedServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.AdministratorValidator;
    const checks: ValidationChecks<PublisherAstType> = {
        AdministratorSaleType: validator.checkSaleOnlyHasDiscountsWithinSalePeriod
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class AdministratorValidator {
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
}
