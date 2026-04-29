import { AstUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { isPublisherDiscountType, PublisherDiscountType, PublisherSaleType, PublisherVersionType, type PublisherAstType } from './generated/ast.js';
import type { SharedServices } from './shared-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecksPublisher(services: SharedServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PublisherValidator;
    const checks: ValidationChecks<PublisherAstType> = {
        PublisherDiscountType: validator.checkDiscountsDoNotOverlap,
        PublisherSaleType: validator.checkDiscountPeriodsWithinSalePeriod,
        PublisherVersionType: validator.checkCurrentVersionIsApproved
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class PublisherValidator {
    checkDiscountsDoNotOverlap(discount: PublisherDiscountType, accept: ValidationAcceptor): void {
        const container = discount.$container;

        const allDiscounts = AstUtils.streamAllContents(container)
            .filter(isPublisherDiscountType)
            .filter(d => d.game == discount.game)
            .toArray();

        for (const otherDiscount of allDiscounts) {
            if (otherDiscount !== discount) {
                const otherStart = new Date(otherDiscount.start_date);
                const otherEnd = new Date(otherDiscount.end_date);
                const discountStart = new Date(discount.start_date);
                const discountEnd = new Date(discount.end_date);
                
                if (discountStart < otherEnd && discountEnd > otherStart) {
                    accept('error', 'Discount periods should not overlap.', { node: discount });
                    break;
                }
            }
        }
    }

    checkDiscountPeriodsWithinSalePeriod(sale: PublisherSaleType, accept: ValidationAcceptor): void {
        const saleStart = new Date(sale.start_date);
        const saleEnd = new Date(sale.end_date);
        
        for (const discount of sale.discounts) {      
            const discountStart = new Date(discount.ref.start_date);
            const discountEnd = new Date(discount.ref.end_date);

            if (discountStart < saleStart || discountEnd > saleEnd) {
                accept('error', 'Discount periods in a sale event must be within the sale\'s period.', { node: discount.ref });
                break;
            }
        }
    }

    checkCurrentVersionIsApproved(version: PublisherVersionType, accept: ValidationAcceptor): void {
        if (version.is_current && !version.approved){
            accept('error', 'Current version must be approved', { node: version, property: 'is_current' });

        }
    }
}
