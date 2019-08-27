# Deprecation notice

Please note, this repository is deprecated and no longer supported. 
It is highly recommended that you ensure that package dependencies are updated to the latest version to get the latest security patches.

# Project details

This project contains an implementation for using MQ Light as the transport with the [seneca](http://senecajs.org) micro-services framework.

```javascript
var seneca = require('seneca')()
	.use('mqlight-transport')
```
this specifies that this instance of seneca should import the mqlight-transport

```javascript
seneca.listen({type:'mqlight'})
```
says that the services defined for this seneca instance should be made available over MQ Light

```javascript
seneca.client({type:'mqlight'})
```
says that this instance of seneca will use MQ Light when calling services as a client

This project is licensed under the Eclipse Public License, details can be found in the file `LICENSE`
