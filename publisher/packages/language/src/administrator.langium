grammar Administrator

import "publisher";

entry AdministratorModel:
    (games+=Game | publishers+=GamePublisher | requests+=GameApprovalRequest | sales+=Sale | reviews+=Review | genres+=Genre)*;


