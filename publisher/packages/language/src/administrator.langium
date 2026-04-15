grammar Administrator

import "publisher";
import "player";

interface AdministratorType extends NamedElement {}

interface AdministratorGameType extends NamedElement {
    release_date: string
    price: number
    state: string
    versions: AdministratorVersionType[]
    genre: @AdministratorGenreType[]
    publisher: @PublisherType
}

interface AdministratorVersionType {
    ID: string
    game_files: string
    is_current: boolean
    approved: boolean
}

interface AdministratorGameApprovalRequestType {
    game_version: @AdministratorVersionType
    status: string
}

interface AdministratorGenreType extends PublisherGenreType {}

interface AdministratorDiscountType {
    percentage: number
    start_date: string
    end_date: string
    game: @AdministratorGameType
}

interface AdministratorSaleType extends NamedElement {
    start_date: string
    end_date: string
    discounts: AdministratorDiscountType[]
}

interface AdministratorReviewType {
    game: @AdministratorGameType
    content: string
    is_flagged: boolean 
    author: @PlayerType  
}



entry AdministratorModel:
    (games+=Game | administrators+=Administrator | requests+=GameApprovalRequest | sales+=Sale | discounts+=Discount | genres+=AdministratorGenre)*;

Administrator returns AdministratorType:
    'administrator' name=ID;

AdministratorGenre returns AdministratorGenreType:
    'genre' name=ID
    'description' description=STRING;

AdministratorSale returns AdministratorSaleType:
    'sale' name=ID
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'discounts' discounts+=AdministratorDiscount (',' discounts+=AdministratorDiscount)*;

AdministratorDiscount returns AdministratorDiscountType:
    'percentage' percentage=INT
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'game' game=[AdministratorGameType:ID];

AdministratorReview returns AdministratorReviewType:
    'review' 'content' content=STRING
    'is_flagged' is_flagged=BOOLEAN
    'game' game=[AdministratorGameType:ID]
    'author' author=[PlayerType:ID];
