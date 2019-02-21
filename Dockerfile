FROM node:10
MAINTAINER Ansel Santosa <ansel@santosa.family>

WORKDIR /opt/app
EXPOSE 50708
ENTRYPOINT ["./run.sh"]
