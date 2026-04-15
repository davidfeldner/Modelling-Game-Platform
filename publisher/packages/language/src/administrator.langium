grammar Administrator

import "publisher";

interface AdministratorType extends NamedElement {

}

interface AdministratorReviewType {

}



entry AdministratorModel:
    (games+=Game | administrators+=Administrator | requests+=GameApprovalRequest | sales+=Sale | genres+=Genre)*;

Administrator returns AdministratorType:
    'administrator' name=ID;

Genre returns GenreType:
    'genre' name=ID
    'description' description=STRING;
