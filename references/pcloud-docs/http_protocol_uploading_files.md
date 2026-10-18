# pCloud docs: protocols/http_json_protocol/uploading_files.html

> Source: https://docs.pcloud.com/protocols/http_json_protocol/uploading_files.html

# HTTP / JSON protocol

## Uploading files

Data/files can be uploaded over HTTP by using the *POST* method and *"multipart/form-data"* encoding, or using a *PUT* request.\
\
For the *PUT* request the body is the data. In this case you must send all your parameters as part of the request.\
\
*PUT* can upload just one file, *POST* can do multiple files.

If a filename is needed it must be passed in filename parameter.

When uploading files you can skip passing the *"Content-Length"* header if it is hard or impossible to compute. If you are using *POST* method, you have a proper way of indicating end of upload - boundary with trailing **--**.\
\
If you are using *PUT* method you can only indicate end of stream by closing the connection in this case (closing the sending end and still reading the reply of course will work).

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
