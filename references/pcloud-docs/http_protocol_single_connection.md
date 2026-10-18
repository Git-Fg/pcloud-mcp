# pCloud docs: protocols/http_json_protocol/single_connection.html

> Source: https://docs.pcloud.com/protocols/http_json_protocol/single_connection.html

# HTTP / JSON protocol

## Using single connection

You can push multiple requests over single connection without waiting for answer, to improve performance. The server will process the requests in the order they are received and you are guaranteed to receive answers in the same order. It is important however to send all requests with *"Connection: keep-alive"*, otherwise the API server will close the connection without processing the pending requests. The server will also close the connection on any bad request (bad HTTP request, not-existing method or anything else that the server doesn't understand). The connection does not close when you get the error from a valid method (like fileid not found, folder is not empty, etc.). It is perfectly safe to send multiple requests at once (like in one network packet).\
\
The API server may in some cases send compressed content if the client indicates support for it (via the *"Accept-Encoding"* header).\
\
When possible you should use single connection for all metadata requests, as explained earlier it is perfectly fine to send new requests without knowing the status of the previous requests. This will not slow down your application, as the chances are that more time is taken by the network latency than for processing the actual request request.

However you should make sure that in no event two threads/processes write to the same connection at the same time.

The API server will not be able to respond correctly to two interleaved requests and data corruption may occur. While writes of small amount of data on a socket MIGHT be atomic on some operating systems it is preferable to use locks or dedicated thread responsible for all the reading/writing to the socket.\
\
Initially connections open to the server have quite low inactivity timeout. However once you authenticate over the connection the timeout will be quite long (over an hour).

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
