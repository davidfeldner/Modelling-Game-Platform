import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { PublisherAstType, Person } from './generated/ast.js';
import type { PublisherServices } from './publisher-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: PublisherServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PublisherValidator;
    const checks: ValidationChecks<PublisherAstType> = {
        Person: validator.checkPersonStartsWithCapital
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class PublisherValidator {

    checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
        if (person.name) {
            const firstChar = person.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
            }
        }
    }

}
