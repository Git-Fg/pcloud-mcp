# pCloud docs: structures/share.html

> Source: https://docs.pcloud.com/structures/share.html

### share

For shares, a "share" object is provided with keys:

|  |  |
|----|----|
| Code | Description |
| **folderid** | int id of the folder |
| **sharerequestid** | int id of the sharerequest, can be used to accept request, not available in removeshare and modifiedshare |
| **shareid** | int shareid of the share, only available in acceptedshare\* and removeshare\* |
| **sharename** | string name of the share, normally that is the name of the directory the user is sharing, not available in removeshare\* and modifiedshare\* |
| **created** | datetime date/time when the share request is sent, not available in removeshare\* and modifiedshare\* |
| **expires** | datetime date/time when the share request expires, not available in removeshare\* and modifiedshare\* |
| **cancreate** | bool flag that you are granded create permissions, not available in removeshare\* |
| **canread** | bool flag that you are granded read permissions, not available in removeshare\* |
| **canmodify** | bool flag that you are granded modify permissions, not available in removeshare\* |
| **candelete** | bool flag that you are granded delete permissions, not available in removeshare\* |
| **message** | string optional message provided by the user offering share (may not be provided), not available in removeshare\* and modifiedshare\* |

For \*in shares:

|                |                                          |
|----------------|------------------------------------------|
| Code           | Description                              |
| **fromuserid** | int userid of the user offering share    |
| **frommail**   | string e-mail of the user offering share |

For \*out shares:

|  |  |
|----|----|
| Code | Description |
| **touserid** | int userid of the user receiving share (not available in requestshareout, declinedshareout and cancelledshareout) |
| **tomail** | string e-mail of the user receiving share |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
