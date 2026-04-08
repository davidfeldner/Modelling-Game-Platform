grammar Player

import "publisher";

entry PlayerModel:
    (games+=Game | publishers+=GamePublisher | requests+=GameApprovalRequest | sales+=Sale | reviews+=Review | genres+=Genre)*;


