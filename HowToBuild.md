## Docker image build

```
docker build -t stream-recaster . 
```

## Docker hub
To push to docker hub:  

docker login (if needed, use --username=impleo --password= )
Get the id:
```
  docker images 
```
Tag the image: 
```
  docker tag 7f69407285e238527095662bb179f78b0263040bf4b41b96f4a068d268df546e impleo/stream-recaster:1.0.7

```
Push:
```
  docker push impleo/stream-recaster:1.0.7
```  