# pCloud docs: methods/archiving/extractarchive.html

> Source: https://docs.pcloud.com/methods/archiving/extractarchive.html

## extractarchive

Name

extractarchive

Auth

yes

Description

Extracts archive file from the user's filesystem.

Expects as paramters usual fileid or path of an archive file and tofolderid or topath for destination folder.

If the archive is password protected, password parameter should be provided, otherwise error number 7009 will be returned. Implementations should expect this error code and if encountered prompt user for password and retry the extraction process.

This method runs the extraction process for around 2 seconds. In case it manages to finish in these 2 seconds, finished will be set to true in the response. Otherwise finished will be false and progresshash will be provided. This value can be passed to extractarchiveprogress in order to continue the monitoring of the extraction process. In this case also information about current server is returned the same way as provided by currentserver. Monitoring extraction can only be done by sending requests to the same server as returned in the hostname.

Unless nooutput is set this method also returns output array of lines (with no newlines in the end) that are the output of the extraction program. The number returned in lines can be used to instruct extractarchiveprogress not to return the same lines of output again.

URL

https://api.pcloud.com/extractarchive

Optional

|           |                                                                                                                                    |
|-----------|------------------------------------------------------------------------------------------------------------------------------------|
| Parameter | Description                                                                                                                        |
| **nooutput** | boolean if set extraction output is not returned                                                                                |
| **overwrite** | string specifies what to do if file to extract already exists in the folder, can be one of 'rename' (default), 'overwrite' and 'skip' |
| **password** | string password to use to extract a password protected archive                                                                  |

Output

Described above: `finished` (bool), `progresshash` (string, when not finished), `lines` (int, count of output lines already returned), `output` (array of lines), plus `ip`/`hostname`/`ipbin`/`ipv6` of the server performing the extraction when polling must continue.

Example

```json
{
  "progresshash": "KooPMKmcEBp",
  "ip": "204.155.151.23",
  "hostname": "api5.pcloud.com",
  "ipv6": "::1",
  "result": 0,
  "lines": 10,
  "ipbin": "204.155.151.45",
  "finished": false,
  "output": [
    "Titov.zip: Zip",
    "  Titov/_ART5055.jpg  (1681557 B)... OK.",
    "  Titov/_ART5059.jpg  (1713601 B)... OK."
  ]
}
```

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **1037** | Please provide at least one of 'topath', 'tofolderid' or 'toname'. |
| **2000** | Log in failed. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2005** | Directory does not exist. |
| **2009** | File not found. |
| **2010** | Invalid path. |
| **2059** | Unsupported archive format. |
| **3006** | Extracting of the archive failed. |
| **4000** | Too many login tries from this IP address. |
| **7009** | Archive is password protected, please supply 'password'. |
