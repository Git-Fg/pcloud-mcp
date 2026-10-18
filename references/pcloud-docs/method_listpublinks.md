# pCloud docs: methods/public_links/listpublinks.html

> Source: https://docs.pcloud.com/methods/public_links/listpublinks.html

## listpublinks

Name

listpublinks

Auth

yes

Description

Return a list of current user's public links\
\
Takes no parameters

URL

https://api.pcloud.com/listpublinks

Output

Returns all user's public links in array publinks. For each link the following fields are provided:

[TABLE]

If the link has a short link:

|  |  |
|----|----|
| Field | Description |
| **shortcode** | string see [getfilepublink](/methods/public_links/getfilepublink.html) |
| **shortlink** | string see [getfilepublink](/methods/public_links/getfilepublink.html) |

If the link has a short link:

|             |                                                          |
|-------------|----------------------------------------------------------|
| Field       | Description                                              |
| **expires** | datetime date/time the link will expire (or has expired) |

If the link has download limit:

|                  |                                               |
|------------------|-----------------------------------------------|
| Field            | Description                                   |
| **maxdownloads** | int maximum number of downloads for this link |

If the link has traffic limit:

|                |                                   |
|----------------|-----------------------------------|
| Field          | Description                       |
| **maxtraffic** | int maximum traffic for this link |

It is up to the implementations to detect and properly display links that have expired or reached the download or traffic limit.

Example

{\
    result: 0,\
    publinks: \[\
        {\
            downloads: 0,\
            created: "Thu, 03 Oct 2013 13:06:04 +0000",\
            link: "https://my.pcloud.com/#page=publink&code=fileCode",\
            modified: "Thu, 03 Oct 2013 13:06:04 +0000",\
            code: "fileCode",\
            traffic: 2027520,\
            linkid: linkid,\
            metadata: {\
                parentfolderid: 21721,\
                created: "Wed, 18 Sep 2013 10:18:15 +0000",\
                icon: "audio",\
                size: 17675824,\
                album: "Simple Album",\
                artist: "pCloud",\
                trackno: 1,\
                isfolder: false,\
                contenttype: "audio/mpeg",\
                genre: "Audio",\
                isshared: false,\
                thumb: true,\
                ismine: true,\
                modified: "Wed, 18 Sep 2013 10:19:05 +0000",\
                title: "Simple Audio",\
                category: 3,\
                hash: 6343095883282229000,\
                name: "Simple Audio.mp3",\
                fileid: 618279,\
                id: "f618279"\
            }\
        },\
        {\
            downloads: 0,\
            created: "Thu, 03 Oct 2013 13:11:44 +0000",\
            link: "https://my.pcloud.com/#page=publink&code=folderCode",\
            modified: "Thu, 03 Oct 2013 13:11:44 +0000",\
            code: "folderCode",\
            traffic: 0,\
            linkid: linkid,\
            metadata: {\
                isfolder: true,\
                folderid: 21721,\
                isshared: true,\
                thumb: false,\
                modified: "Wed, 18 Sep 2013 10:25:57 +0000",\
                parentfolderid: 0,\
                created: "Wed, 18 Sep 2013 10:18:14 +0000",\
                ismine: true,\
                icon: "folder",\
                name: "Simple Folder",\
                id: "d21721"\
            }\
        }\
    \]\
}\

### Errors

|          |                                            |
|----------|--------------------------------------------|
| Code     | Description                                |
| **1000** | Log in required.                           |
| **2000** | Log in failed.                             |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later.           |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
